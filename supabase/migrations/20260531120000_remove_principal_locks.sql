-- Deposits and referral bonuses credit withdrawable principal immediately (no 30-day locks).
-- Existing locked balances are moved to withdrawable_principal.

-- ---------------------------------------------------------------------------
-- Backfill: unlock all principal for existing investors
-- ---------------------------------------------------------------------------
UPDATE public.investors AS inv
SET
  withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric
    + coalesce(inv.locked_principal_balance, 0)::numeric,
  locked_principal_balance = 0
WHERE coalesce(inv.locked_principal_balance, 0)::numeric > 0;

UPDATE public.principal_locks AS pl
SET matured = true
WHERE pl.matured IS NOT TRUE;

-- ---------------------------------------------------------------------------
-- approve_deposit: immediate withdrawable principal + rewards hooks
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
    withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric + bump
  WHERE inv.user_id = d.user_id
     OR lower(trim(inv.email)) = lower(trim(d.investor_email));

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
-- Referral bonus: withdrawable immediately
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
    now()
  )
  RETURNING id INTO reward_id;

  UPDATE public.investors AS inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + bonus,
    withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric + bonus
  WHERE inv.user_id = referrer_uid;

  PERFORM public.sync_investment_plan_from_principal(referrer_uid);

  PERFORM public.tp_emit_investor_notification(
    referrer_uid,
    referrer_email,
    'Referral bonus credited',
    format(
      'You earned a $%s referral bonus. It has been added to your withdrawable balance.',
      public._format_money_display(bonus)
    ),
    'referral_bonus'
  );

  PERFORM public.evaluate_referral_milestone_rewards(referrer_uid);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_referral_bonus_for_deposit(uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- P2P merchant release (sell side): immediate withdrawable principal
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
  UPDATE public.investors inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + bump,
    withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric + bump
  WHERE inv.user_id = mo.investor_user_id;

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

-- ---------------------------------------------------------------------------
-- P2P dispute: investor wins sell-side USDT credit
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
    UPDATE public.investors inv
    SET
      balance = coalesce(inv.balance, 0)::numeric + bump,
      withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric + bump
    WHERE inv.user_id = p_mo.investor_user_id;

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
-- Daily job: skip principal maturation (legacy no-op)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mature_principal_locks(p_now timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.mature_principal_locks(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mature_principal_locks(timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
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
    format('Your deposit of $%s was approved and added to your withdrawable balance.', amt),
    'deposit_approved'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tp_notify_deposit_approved_row() FROM PUBLIC;
