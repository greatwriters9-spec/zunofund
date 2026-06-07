-- P2P buy releases were still crediting withdrawable_principal (remove_principal_locks regression).
-- All crypto credits from P2P merchant release must lock principal for 30 days, same as approve_deposit.

-- ---------------------------------------------------------------------------
-- 1) Backfill any approved deposits still missing principal_locks (incl. P2P)
-- ---------------------------------------------------------------------------
WITH missing AS (
  SELECT
    d.id AS deposit_id,
    d.user_id,
    lower(trim(coalesce(d.investor_email, ''))) AS investor_email,
    coalesce(d.amount, 0)::numeric AS amount,
    d.created_at
  FROM public.deposits AS d
  WHERE d.status = 'approved'
    AND coalesce(d.amount, 0) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.principal_locks AS pl
      WHERE pl.deposit_id = d.id
    )
),
by_investor AS (
  SELECT
    m.user_id,
    m.investor_email,
    sum(m.amount) AS repair_total
  FROM missing AS m
  GROUP BY m.user_id, m.investor_email
)
UPDATE public.investors AS inv
SET
  locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + bi.repair_total,
  withdrawable_principal = greatest(
    0::numeric,
    coalesce(inv.withdrawable_principal, 0)::numeric - least(
      coalesce(inv.withdrawable_principal, 0)::numeric,
      bi.repair_total
    )
  )
FROM by_investor AS bi
WHERE inv.user_id IS NOT DISTINCT FROM bi.user_id
   OR (
     bi.user_id IS NULL
     AND lower(trim(coalesce(inv.email, ''))) = bi.investor_email
   );

INSERT INTO public.principal_locks (
  deposit_id,
  user_id,
  investor_email,
  principal_amount,
  locked_until,
  lock_source
)
SELECT
  m.deposit_id,
  m.user_id,
  coalesce(trim((SELECT dep.investor_email FROM public.deposits AS dep WHERE dep.id = m.deposit_id)), ''),
  m.amount,
  m.created_at + interval '30 days',
  'deposit'
FROM (
  SELECT
    d.id AS deposit_id,
    d.user_id,
    coalesce(d.amount, 0)::numeric AS amount,
    d.created_at
  FROM public.deposits AS d
  WHERE d.status = 'approved'
    AND coalesce(d.amount, 0) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.principal_locks AS pl
      WHERE pl.deposit_id = d.id
    )
) AS m;

WITH lock_totals AS (
  SELECT
    pl.user_id,
    lower(trim(pl.investor_email)) AS inv_email,
    sum(pl.principal_amount)::numeric AS lock_sum
  FROM public.principal_locks AS pl
  WHERE pl.matured = false
  GROUP BY pl.user_id, lower(trim(pl.investor_email))
)
UPDATE public.investors AS inv
SET locked_principal_balance = coalesce(lt.lock_sum, 0)
FROM lock_totals AS lt
WHERE inv.user_id IS NOT DISTINCT FROM lt.user_id
   OR lower(trim(coalesce(inv.email, ''))) = lt.inv_email;

-- ---------------------------------------------------------------------------
-- 2) merchant_release_buy_order: lock principal on P2P buy credit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.merchant_release_buy_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  mo public.merchant_orders%ROWTYPE;
  bump numeric;
  inv_email text;
  dep_id uuid;
  until_ts timestamptz;
  sync_uid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'not an active merchant';
  END IF;

  PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);

  SELECT * INTO mo FROM public.merchant_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF mo.merchant_user_id <> auth.uid() THEN RAISE EXCEPTION 'not your order'; END IF;
  IF mo.side NOT IN ('sell_usdt', 'sell_btc') OR mo.status <> 'paid' THEN
    RAISE EXCEPTION 'invalid order state';
  END IF;

  bump := public._p2p_order_usdt_credit(mo);
  IF bump <= 0 THEN RAISE EXCEPTION 'invalid credit amount'; END IF;

  SELECT lower(trim(coalesce(email, ''))) INTO inv_email FROM public.investors WHERE user_id = mo.investor_user_id;
  IF NOT FOUND OR inv_email IS NULL OR inv_email = '' THEN RAISE EXCEPTION 'investor email missing'; END IF;

  INSERT INTO public.deposits (user_id, investor_email, amount, txid, payment_method, status, skip_plan_amount_validation)
  VALUES (mo.investor_user_id, inv_email, bump, 'p2p:' || mo.id::text, 'P2P_MERCHANT', 'pending', true)
  RETURNING id INTO dep_id;

  UPDATE public.deposits AS dep SET status = 'approved' WHERE dep.id = dep_id;

  until_ts := (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 days';

  UPDATE public.investors AS inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + bump,
    locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + bump
  WHERE inv.user_id = mo.investor_user_id;

  INSERT INTO public.principal_locks (
    deposit_id, user_id, investor_email, principal_amount, locked_until, lock_source
  )
  VALUES (dep_id, mo.investor_user_id, inv_email, bump, until_ts, 'deposit');

  sync_uid := mo.investor_user_id;
  PERFORM public.sync_investment_plan_from_principal(sync_uid);
  PERFORM public.evaluate_investor_rewards_bundle(sync_uid, dep_id);
  PERFORM public.advance_investor_holding_streak(sync_uid);
  PERFORM public.apply_referral_bonus_for_deposit(dep_id);

  UPDATE public.merchant_orders AS mo2
  SET status = 'completed', deposit_id = dep_id, updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_release_buy_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_release_buy_order(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) P2P dispute release (USDT): lock principal
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._p2p_dispute_release_crypto_to_investor(p_mo public.merchant_orders)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  bump numeric;
  inv_email text;
  dep_id uuid;
  until_ts timestamptz;
BEGIN
  IF p_mo.side IN ('sell_usdt', 'sell_btc') THEN
    bump := public._p2p_order_usdt_credit(p_mo);
    IF p_mo.side = 'sell_btc' THEN
      bump := coalesce(p_mo.btc_credit_amount, 0);
    END IF;
    IF bump <= 0 THEN
      RAISE EXCEPTION 'invalid credit amount';
    END IF;

    IF p_mo.side = 'sell_btc' THEN
      PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);
      UPDATE public.investors AS inv
      SET
        btc_balance = coalesce(inv.btc_balance, 0)::numeric + bump,
        btc_withdrawable = coalesce(inv.btc_withdrawable, 0)::numeric + bump
      WHERE inv.user_id = p_mo.investor_user_id;
      RETURN;
    END IF;

    PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);

    SELECT lower(trim(coalesce(email, ''))) INTO inv_email
    FROM public.investors
    WHERE user_id = p_mo.investor_user_id;

    IF coalesce(inv_email, '') = '' THEN
      RAISE EXCEPTION 'investor email missing';
    END IF;

    INSERT INTO public.deposits (
      user_id, investor_email, amount, txid, payment_method, status, skip_plan_amount_validation
    )
    VALUES (
      p_mo.investor_user_id, inv_email, bump, 'p2p-dispute:' || p_mo.id::text, 'P2P_MERCHANT', 'pending', true
    )
    RETURNING id INTO dep_id;

    UPDATE public.deposits AS dep SET status = 'approved' WHERE dep.id = dep_id;

    until_ts := (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 days';

    UPDATE public.investors AS inv
    SET
      balance = coalesce(inv.balance, 0)::numeric + bump,
      locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + bump
    WHERE inv.user_id = p_mo.investor_user_id;

    INSERT INTO public.principal_locks (
      deposit_id, user_id, investor_email, principal_amount, locked_until, lock_source
    )
    VALUES (dep_id, p_mo.investor_user_id, inv_email, bump, until_ts, 'deposit');

    PERFORM public.sync_investment_plan_from_principal(p_mo.investor_user_id);
    PERFORM public.evaluate_investor_rewards_bundle(p_mo.investor_user_id, dep_id);
    PERFORM public.advance_investor_holding_streak(p_mo.investor_user_id);
    PERFORM public.apply_referral_bonus_for_deposit(dep_id);

    UPDATE public.merchant_orders AS mo3
    SET deposit_id = dep_id
    WHERE mo3.id = p_mo.id;

    RETURN;
  END IF;

  IF p_mo.side IN ('buy_usdt', 'buy_btc') THEN
    PERFORM public._merchant_restore_sell_escrow(p_mo);
    RETURN;
  END IF;

  RAISE EXCEPTION 'unsupported order side';
END;
$$;

REVOKE ALL ON FUNCTION public._p2p_dispute_release_crypto_to_investor(public.merchant_orders) FROM PUBLIC;
