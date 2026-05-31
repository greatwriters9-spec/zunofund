-- Wallet crypto withdrawals: 30-day principal lock (profits withdrawable anytime).
-- P2P sell: use full portfolio balance (including locked principal); no wallet lock on P2P.

-- ---------------------------------------------------------------------------
-- Repair mistaken unlock (20260531120000): re-apply active principal locks
-- ---------------------------------------------------------------------------
UPDATE public.principal_locks AS pl
SET matured = false
WHERE pl.matured = true
  AND pl.locked_until > (NOW() AT TIME ZONE 'UTC');

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
SET
  locked_principal_balance = lt.lock_sum,
  withdrawable_principal = greatest(
    0::numeric,
    coalesce(inv.withdrawable_principal, 0)::numeric - least(
      coalesce(inv.withdrawable_principal, 0)::numeric,
      lt.lock_sum
    )
  )
FROM lock_totals AS lt
WHERE inv.user_id = lt.user_id
   OR (lt.user_id IS NOT NULL AND inv.user_id = lt.user_id)
   OR (
     lt.user_id IS NULL
     AND lower(trim(coalesce(inv.email, ''))) = lt.inv_email
   );

-- ---------------------------------------------------------------------------
-- P2P sell: track locked-principal slice on escrow orders
-- ---------------------------------------------------------------------------
ALTER TABLE public.merchant_orders
  ADD COLUMN IF NOT EXISTS locked_take_from_locked_principal numeric;

UPDATE public.merchant_orders AS mo
SET locked_take_from_locked_principal = 0
WHERE mo.side IN ('buy_usdt', 'buy_btc')
  AND mo.locked_take_from_locked_principal IS NULL;

ALTER TABLE public.merchant_orders
  ALTER COLUMN locked_take_from_locked_principal SET DEFAULT 0;

ALTER TABLE public.merchant_orders
  DROP CONSTRAINT IF EXISTS merchant_orders_side_amounts_chk;

ALTER TABLE public.merchant_orders
  ADD CONSTRAINT merchant_orders_side_amounts_chk CHECK (
    (side = 'sell_usdt'
      AND usdt_credit_amount IS NOT NULL
      AND usdt_escrow_amount IS NULL
      AND btc_credit_amount IS NULL
      AND btc_escrow_amount IS NULL
      AND locked_btc_amount IS NULL
      AND locked_take_from_profit IS NULL
      AND locked_take_from_principal IS NULL
      AND locked_take_from_locked_principal IS NULL)
    OR
    (side = 'sell_btc'
      AND btc_credit_amount IS NOT NULL
      AND usdt_credit_amount IS NULL
      AND usdt_escrow_amount IS NULL
      AND btc_escrow_amount IS NULL
      AND locked_btc_amount IS NULL
      AND locked_take_from_profit IS NULL
      AND locked_take_from_principal IS NULL
      AND locked_take_from_locked_principal IS NULL)
    OR
    (side = 'buy_usdt'
      AND usdt_escrow_amount IS NOT NULL
      AND usdt_credit_amount IS NULL
      AND btc_credit_amount IS NULL
      AND btc_escrow_amount IS NULL
      AND locked_btc_amount IS NULL
      AND locked_take_from_profit IS NOT NULL
      AND locked_take_from_principal IS NOT NULL
      AND locked_take_from_locked_principal IS NOT NULL)
    OR
    (side = 'buy_btc'
      AND btc_escrow_amount IS NOT NULL
      AND locked_btc_amount IS NOT NULL
      AND usdt_escrow_amount IS NOT NULL
      AND locked_take_from_profit IS NOT NULL
      AND locked_take_from_principal IS NOT NULL
      AND locked_take_from_locked_principal IS NOT NULL
      AND usdt_credit_amount IS NULL
      AND btc_credit_amount IS NULL)
  );

-- ---------------------------------------------------------------------------
-- P2P sellable = full USDT NAV balance minus reserved (not yet deducted) escrows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._p2p_investor_sellable_usd(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  inv public.investors%ROWTYPE;
  pend_usd numeric := 0;
BEGIN
  SELECT * INTO inv FROM public.investors WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT coalesce(sum(public._p2p_order_usdt_escrow(mo)), 0)
  INTO pend_usd
  FROM public.merchant_orders mo
  WHERE mo.investor_user_id = p_user_id
    AND mo.side IN ('buy_usdt', 'buy_btc')
    AND mo.status IN ('pending_payment', 'paid')
    AND NOT coalesce(mo.investor_crypto_deducted_at_lock, false);

  RETURN greatest(0::numeric, coalesce(inv.balance, 0)::numeric - pend_usd);
END;
$$;

-- Wallet withdrawals still use withdrawable components only (unchanged).
CREATE OR REPLACE FUNCTION public._p2p_investor_withdrawable_usd(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  inv public.investors%ROWTYPE;
  pend_usd numeric := 0;
BEGIN
  SELECT * INTO inv FROM public.investors WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT coalesce(sum(public._p2p_order_usdt_escrow(mo)), 0)
  INTO pend_usd
  FROM public.merchant_orders mo
  WHERE mo.investor_user_id = p_user_id
    AND mo.side IN ('buy_usdt', 'buy_btc')
    AND mo.status IN ('pending_payment', 'paid')
    AND NOT coalesce(mo.investor_crypto_deducted_at_lock, false);

  RETURN greatest(
    0::numeric,
    coalesce(inv.withdrawable_profit, 0)::numeric
      + coalesce(inv.withdrawable_principal, 0)::numeric
      - pend_usd
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_p2p_sell_crypto_deduction(
  p_user_id uuid,
  p_amount numeric,
  OUT take_from_profit numeric,
  OUT take_from_principal numeric,
  OUT take_from_locked numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  inv_row public.investors%ROWTYPE;
  amt numeric;
  remain numeric;
BEGIN
  amt := round(coalesce(p_amount, 0), 8);
  IF amt <= 0 THEN
    RAISE EXCEPTION 'invalid p2p sell amount';
  END IF;

  take_from_profit := 0;
  take_from_principal := 0;
  take_from_locked := 0;

  PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);

  SELECT *
  INTO inv_row
  FROM public.investors
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'investor not found';
  END IF;

  take_from_profit := LEAST(amt, coalesce(inv_row.withdrawable_profit, 0));
  remain := amt - take_from_profit;
  take_from_principal := LEAST(remain, coalesce(inv_row.withdrawable_principal, 0));
  remain := remain - take_from_principal;
  take_from_locked := LEAST(remain, coalesce(inv_row.locked_principal_balance, 0));

  IF take_from_profit + take_from_principal + take_from_locked < amt THEN
    RAISE EXCEPTION 'insufficient balance for p2p sell';
  END IF;

  UPDATE public.investors AS inv
  SET
    balance = greatest(0::numeric, coalesce(inv.balance, 0)::numeric - amt),
    withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric - take_from_profit,
    withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric - take_from_principal,
    locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric - take_from_locked
  WHERE inv.user_id = p_user_id
     OR lower(trim(inv.email)) = lower(trim(inv_row.email));

  PERFORM public.sync_investment_plan_from_principal(inv_row.user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_p2p_sell_crypto_deduction(uuid, numeric) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.investor_p2p_sellable_balances()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  inv public.investors%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO inv FROM public.investors WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'portfolio_usd', 0,
      'sellable_usd', 0,
      'wallet_withdrawable_usd', 0,
      'locked_principal_usd', 0,
      'withdrawable_profit_usd', 0
    );
  END IF;

  RETURN jsonb_build_object(
    'portfolio_usd', coalesce(inv.balance, 0),
    'sellable_usd', public._p2p_investor_sellable_usd(auth.uid()),
    'wallet_withdrawable_usd', coalesce(inv.withdrawable_balance, 0),
    'locked_principal_usd', coalesce(inv.locked_principal_balance, 0),
    'withdrawable_profit_usd', coalesce(inv.withdrawable_profit, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.investor_p2p_sellable_balances() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_p2p_sellable_balances() TO authenticated;

-- ---------------------------------------------------------------------------
-- Restore principal maturity job
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mature_principal_locks(p_now timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT *
    FROM public.principal_locks
    WHERE matured = false
      AND locked_until <= p_now
    ORDER BY locked_until
    FOR UPDATE
  LOOP
    UPDATE public.principal_locks AS pl
    SET matured = true
    WHERE pl.id = rec.id;

    UPDATE public.investors AS inv
    SET
      locked_principal_balance = greatest(
        0::numeric,
        coalesce(inv.locked_principal_balance, 0)::numeric - rec.principal_amount::numeric
      ),
      withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric + rec.principal_amount::numeric
    WHERE inv.user_id = rec.user_id
       OR lower(trim(inv.email)) = lower(trim(rec.investor_email));
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.mature_principal_locks(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mature_principal_locks(timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- approve_deposit: lock principal for wallet; full balance still on NAV
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.deposits%ROWTYPE;
  bump numeric;
  until_ts timestamptz;
  investor_uid uuid;
  referrer_uid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT *
  INTO d
  FROM public.deposits AS dep
  WHERE dep.id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit not found';
  END IF;

  IF d.status IS DISTINCT FROM 'pending' THEN
    RETURN;
  END IF;

  bump := coalesce(d.amount::numeric, 0);

  UPDATE public.deposits AS dep
  SET status = 'approved'
  WHERE dep.id = p_deposit_id;

  UPDATE public.investors AS inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + bump,
    locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + bump
  WHERE inv.user_id = d.user_id
     OR lower(trim(inv.email)) = lower(trim(d.investor_email));

  until_ts := (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 days';

  INSERT INTO public.principal_locks (
    deposit_id,
    user_id,
    investor_email,
    principal_amount,
    locked_until,
    lock_source
  )
  VALUES (
    p_deposit_id,
    d.user_id,
    coalesce(trim(d.investor_email), ''),
    bump,
    until_ts,
    'deposit'
  );

  investor_uid := d.user_id;
  IF investor_uid IS NULL THEN
    SELECT inv.user_id
    INTO investor_uid
    FROM public.investors AS inv
    WHERE lower(trim(inv.email)) = lower(trim(d.investor_email))
    LIMIT 1;
  END IF;

  IF investor_uid IS NOT NULL THEN
    PERFORM public.sync_investment_plan_from_principal(investor_uid);
    PERFORM public.evaluate_investor_rewards_bundle(investor_uid, p_deposit_id);
    PERFORM public.advance_investor_holding_streak(investor_uid);
  END IF;

  PERFORM public.apply_referral_bonus_for_deposit(p_deposit_id);

  IF investor_uid IS NOT NULL THEN
    PERFORM public.evaluate_referral_milestone_rewards(investor_uid);

    SELECT inv.referred_by_user_id
    INTO referrer_uid
    FROM public.investors AS inv
    WHERE inv.user_id = investor_uid;

    IF referrer_uid IS NOT NULL THEN
      PERFORM public.evaluate_referral_milestone_rewards(referrer_uid);
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_deposit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_deposit(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Referral bonus: locked for wallet, sellable on P2P
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_referral_bonus_for_deposit(p_deposit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.deposits%ROWTYPE;
  referred_inv public.investors%ROWTYPE;
  referrer_uid uuid;
  referrer_email text;
  referrer_code text;
  bonus numeric;
  until_ts timestamptz;
  reward_id uuid;
BEGIN
  SELECT *
  INTO d
  FROM public.deposits AS dep
  WHERE dep.id = p_deposit_id;

  IF NOT FOUND OR d.status IS DISTINCT FROM 'approved' THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.referral_rewards AS rr WHERE rr.deposit_id = p_deposit_id
  ) THEN
    RETURN;
  END IF;

  SELECT *
  INTO referred_inv
  FROM public.investors AS inv
  WHERE inv.user_id = d.user_id
     OR lower(trim(inv.email)) = lower(trim(d.investor_email))
  LIMIT 1;

  IF NOT FOUND OR referred_inv.user_id IS NULL THEN
    RETURN;
  END IF;

  referrer_uid := referred_inv.referred_by_user_id;

  IF referrer_uid IS NULL AND coalesce(public._normalize_referral_code(d.referral_code), '') <> '' THEN
    referrer_uid := public._referral_referrer_for_code(d.referral_code, referred_inv.user_id);

    IF referrer_uid IS NOT NULL THEN
      UPDATE public.investors AS inv
      SET
        referred_by_user_id = referrer_uid,
        referred_at = coalesce(inv.referred_at, now())
      WHERE inv.user_id = referred_inv.user_id
        AND inv.referred_by_user_id IS NULL;
    END IF;
  END IF;

  IF referrer_uid IS NULL OR referrer_uid IS NOT DISTINCT FROM referred_inv.user_id THEN
    RETURN;
  END IF;

  bonus := round(coalesce(d.amount, 0)::numeric * 0.05, 8);
  IF bonus <= 0 THEN
    RETURN;
  END IF;

  SELECT lower(trim(coalesce(inv.email, ''))), inv.referral_code
  INTO referrer_email, referrer_code
  FROM public.investors AS inv
  WHERE inv.user_id = referrer_uid
  LIMIT 1;

  IF coalesce(referrer_email, '') = '' THEN
    RETURN;
  END IF;

  until_ts := (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 days';

  INSERT INTO public.referral_rewards (
    deposit_id,
    referrer_user_id,
    referred_user_id,
    referral_code,
    deposit_amount,
    bonus_amount,
    locked_until
  )
  VALUES (
    p_deposit_id,
    referrer_uid,
    referred_inv.user_id,
    referrer_code,
    coalesce(d.amount, 0)::numeric,
    bonus,
    until_ts
  )
  RETURNING id INTO reward_id;

  UPDATE public.investors AS inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + bonus,
    locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + bonus
  WHERE inv.user_id = referrer_uid;

  INSERT INTO public.principal_locks (
    deposit_id,
    user_id,
    investor_email,
    principal_amount,
    locked_until,
    lock_source,
    referral_reward_id
  )
  VALUES (
    NULL,
    referrer_uid,
    referrer_email,
    bonus,
    until_ts,
    'referral_bonus',
    reward_id
  );

  PERFORM public.sync_investment_plan_from_principal(referrer_uid);

  PERFORM public.tp_emit_investor_notification(
    referrer_uid,
    referrer_email,
    'Referral bonus credited',
    format(
      'You earned a $%s referral bonus. It is available for P2P trading now; crypto wallet withdrawals unlock after 30 days.',
      public._format_money_display(bonus)
    ),
    'referral_bonus'
  );

  PERFORM public.evaluate_referral_milestone_rewards(referrer_uid);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_referral_bonus_for_deposit(uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- P2P merchant release / dispute credit: lock for wallet
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

  UPDATE public.deposits dep SET status = 'approved' WHERE dep.id = dep_id;

  until_ts := (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 days';

  UPDATE public.investors inv
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

  UPDATE public.merchant_orders mo2
  SET status = 'completed', deposit_id = dep_id, updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_release_buy_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_release_buy_order(uuid) TO authenticated;

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
      UPDATE public.investors inv
      SET
        btc_balance = coalesce(inv.btc_balance, 0)::numeric + bump,
        btc_withdrawable = coalesce(inv.btc_withdrawable, 0)::numeric + bump
      WHERE inv.user_id = p_mo.investor_user_id;
      RETURN;
    END IF;

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

    UPDATE public.deposits dep SET status = 'approved' WHERE dep.id = dep_id;

    until_ts := (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 days';

    UPDATE public.investors inv
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

    UPDATE public.merchant_orders mo3
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

-- ---------------------------------------------------------------------------
-- Restore escrow on P2P sell cancel (including locked principal slice)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._merchant_restore_sell_escrow(p_mo public.merchant_orders)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  amt numeric;
BEGIN
  IF coalesce(p_mo.investor_crypto_deducted_at_lock, false) THEN
    PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);
    amt := public._p2p_order_usdt_escrow(p_mo);
    IF amt <= 0 THEN
      RETURN;
    END IF;

    UPDATE public.investors AS inv
    SET
      balance = coalesce(inv.balance, 0)::numeric + amt,
      withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric
        + coalesce(p_mo.locked_take_from_profit, 0),
      withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric
        + coalesce(p_mo.locked_take_from_principal, 0),
      locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric
        + coalesce(p_mo.locked_take_from_locked_principal, 0)
    WHERE inv.user_id = p_mo.investor_user_id;

    PERFORM public.sync_investment_plan_from_principal(p_mo.investor_user_id);
    RETURN;
  END IF;

  IF coalesce(p_mo.defer_investor_deduction_until_release, false) THEN
    RETURN;
  END IF;

  amt := coalesce(p_mo.usdt_escrow_amount, 0);
  IF amt <= 0 THEN
    RETURN;
  END IF;

  PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);

  UPDATE public.investors AS inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + amt,
    withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric
      + coalesce(p_mo.locked_take_from_profit, 0),
    withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric
      + coalesce(p_mo.locked_take_from_principal, 0),
    locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric
      + coalesce(p_mo.locked_take_from_locked_principal, 0)
  WHERE inv.user_id = p_mo.investor_user_id;

  PERFORM public.sync_investment_plan_from_principal(p_mo.investor_user_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- P2P sell order: full balance, p2p deduction
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.investor_create_merchant_sell_order(
  p_offer_id uuid,
  p_fiat_amount numeric,
  p_payment_method text,
  p_investor_payout_instructions text DEFAULT NULL,
  p_fx_rate_usd_at_open numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  off public.merchant_offers%ROWTYPE;
  take_from_profit numeric;
  take_from_principal numeric;
  take_from_locked numeric;
  amt numeric;
  usdt_amt numeric;
  oid uuid;
  instr text;
  ccy text;
  rate_used numeric;
  fiat_amt numeric;
  asset text;
  need_usd numeric;
  avail_usd numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'merchants cannot open investor sell orders';
  END IF;

  SELECT * INTO off FROM public.merchant_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'offer not found'; END IF;

  asset := public._p2p_asset_from_side(off.side);

  IF off.status <> 'active' OR off.side NOT IN ('buy_usdt', 'buy_btc') THEN
    RAISE EXCEPTION 'invalid offer';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.merchant_profiles mp
    WHERE mp.user_id = off.merchant_user_id AND mp.status = 'active'
  ) THEN
    RAISE EXCEPTION 'merchant inactive';
  END IF;

  fiat_amt := round(coalesce(p_fiat_amount, 0), 4);
  IF fiat_amt <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;

  ccy := coalesce(nullif(trim(off.fiat_currency_code), ''), 'USD');
  IF fiat_amt < off.min_limit OR fiat_amt > off.max_limit THEN
    RAISE EXCEPTION 'amount outside offer limits';
  END IF;

  IF trim(coalesce(p_payment_method, '')) = '' THEN RAISE EXCEPTION 'payment method required'; END IF;
  IF NOT (p_payment_method = ANY (off.payment_methods)) THEN
    RAISE EXCEPTION 'payment method not accepted by this offer';
  END IF;

  instr := nullif(trim(coalesce(p_investor_payout_instructions, '')), '');

  IF p_fx_rate_usd_at_open IS NOT NULL AND p_fx_rate_usd_at_open > 0 THEN
    rate_used := p_fx_rate_usd_at_open;
  ELSE
    rate_used := public._p2p_usd_per_unit(ccy);
  END IF;

  need_usd := public._p2p_to_usd(fiat_amt, ccy);

  usdt_amt := round(
    need_usd / greatest(0.0001, (1.0 + coalesce(off.rate_percentage, 0) / 100.0)),
    8
  );
  IF usdt_amt <= 0 THEN RAISE EXCEPTION 'invalid usdt escrow amount'; END IF;

  amt := round(public._p2p_from_usd(public._p2p_to_usd(usdt_amt, 'USDT'), asset), 8);
  IF amt <= 0 THEN RAISE EXCEPTION 'invalid converted amount'; END IF;

  avail_usd := public._p2p_investor_sellable_usd(auth.uid());
  IF usdt_amt > avail_usd THEN
    RAISE EXCEPTION 'insufficient balance for p2p sell';
  END IF;

  SELECT *
  INTO take_from_profit, take_from_principal, take_from_locked
  FROM public.apply_p2p_sell_crypto_deduction(auth.uid(), usdt_amt);

  IF asset = 'BTC' THEN
    INSERT INTO public.merchant_orders (
      investor_user_id, merchant_user_id, offer_id, side, amount_requested,
      rate_percentage, fee_amount, btc_escrow_amount, locked_btc_amount,
      usdt_escrow_amount, locked_take_from_profit, locked_take_from_principal,
      locked_take_from_locked_principal,
      payment_method, investor_payout_instructions, defer_investor_deduction_until_release,
      investor_crypto_deducted_at_lock, status, expires_at,
      fiat_currency_code, fiat_amount, fx_rate_usd_at_open
    )
    VALUES (
      auth.uid(), off.merchant_user_id, off.id, 'buy_btc', amt, off.rate_percentage, 0, amt, amt,
      usdt_amt, take_from_profit, take_from_principal, take_from_locked,
      trim(p_payment_method), instr, false, true, 'pending_payment',
      (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 minutes', ccy, fiat_amt, rate_used
    )
    RETURNING id INTO oid;
  ELSE
    INSERT INTO public.merchant_orders (
      investor_user_id, merchant_user_id, offer_id, side, amount_requested,
      rate_percentage, fee_amount, usdt_escrow_amount, locked_take_from_profit,
      locked_take_from_principal, locked_take_from_locked_principal,
      payment_method, investor_payout_instructions,
      defer_investor_deduction_until_release, investor_crypto_deducted_at_lock,
      status, expires_at, fiat_currency_code, fiat_amount, fx_rate_usd_at_open
    )
    VALUES (
      auth.uid(), off.merchant_user_id, off.id, 'buy_usdt', amt, off.rate_percentage, 0, usdt_amt,
      take_from_profit, take_from_principal, take_from_locked,
      trim(p_payment_method), instr, false, true,
      'pending_payment', (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 minutes', ccy, fiat_amt, rate_used
    )
    RETURNING id INTO oid;
  END IF;

  RETURN oid;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_create_merchant_sell_order(uuid, numeric, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_create_merchant_sell_order(uuid, numeric, text, text, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.tp_notify_deposit_approved_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt text := public._format_money_display(NEW.amount);
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    NEW.user_id,
    NEW.investor_email,
    'Deposit approved',
    format(
      'Your deposit of $%s was approved. Use it on P2P anytime; crypto wallet principal withdrawals unlock after 30 days.',
      amt
    ),
    'deposit_approved'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tp_notify_deposit_approved_row() FROM PUBLIC;
