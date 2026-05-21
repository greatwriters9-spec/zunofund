CREATE OR REPLACE FUNCTION public._withdrawal_input_to_usdt(p_amount numeric, p_payment_method text)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT round(
    CASE
      WHEN public._withdrawal_asset_code(p_payment_method) = 'BTC' THEN
        public._p2p_from_usd(public._p2p_to_usd(coalesce(p_amount, 0), 'BTC'), 'USDT')
      ELSE coalesce(p_amount, 0)
    END,
    8
  );
$$;

CREATE OR REPLACE FUNCTION public._p2p_btc_amount_to_usdt(p_btc numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT round(public._p2p_from_usd(public._p2p_to_usd(coalesce(p_btc, 0), 'BTC'), 'USDT'), 8);
$$;

CREATE OR REPLACE FUNCTION public._p2p_order_usdt_escrow(p_mo public.merchant_orders)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT round(
    coalesce(
      p_mo.usdt_escrow_amount,
      public._p2p_btc_amount_to_usdt(p_mo.btc_escrow_amount),
      0
    ),
    8
  );
$$;

CREATE OR REPLACE FUNCTION public._p2p_order_usdt_credit(p_mo public.merchant_orders)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT round(
    coalesce(
      p_mo.usdt_credit_amount,
      public._p2p_btc_amount_to_usdt(p_mo.btc_credit_amount),
      0
    ),
    8
  );
$$;

CREATE OR REPLACE FUNCTION public.apply_crypto_withdrawal_deduction(
  p_user_id uuid,
  p_amount numeric,
  p_asset text DEFAULT 'USDT'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  inv_row public.investors%ROWTYPE;
  take_from_profit numeric;
  take_from_principal numeric;
  remain numeric;
  amt numeric;
BEGIN
  amt := round(coalesce(p_amount, 0), 8);
  IF amt <= 0 THEN
    RAISE EXCEPTION 'invalid withdrawal amount';
  END IF;

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

  IF take_from_profit + take_from_principal < amt THEN
    RAISE EXCEPTION 'insufficient withdrawable funds';
  END IF;

  UPDATE public.investors AS inv
  SET
    balance = greatest(0::numeric, coalesce(inv.balance, 0)::numeric - amt),
    withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric - take_from_profit,
    withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric - take_from_principal
  WHERE inv.user_id = p_user_id
     OR lower(trim(inv.email)) = lower(trim(inv_row.email));

  PERFORM public.sync_investment_plan_from_principal(inv_row.user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_crypto_withdrawal_deduction(uuid, numeric, text) FROM PUBLIC;

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
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT coalesce(sum(public._p2p_to_usd(public._p2p_order_usdt_escrow(mo), 'USDT')), 0)
  INTO pend_usd
  FROM public.merchant_orders mo
  WHERE mo.investor_user_id = p_user_id
    AND mo.side IN ('buy_usdt', 'buy_btc')
    AND mo.status IN ('pending_payment', 'paid')
    AND NOT coalesce(mo.investor_crypto_deducted_at_lock, false);

  RETURN greatest(
    0::numeric,
    public._p2p_to_usd(coalesce(inv.withdrawable_profit, 0), 'USDT')
      + public._p2p_to_usd(coalesce(inv.withdrawable_principal, 0), 'USDT')
      - pend_usd
  );
END;
$$;

ALTER TABLE public.merchant_orders
  DROP CONSTRAINT IF EXISTS merchant_orders_side_amounts_chk;

UPDATE public.merchant_orders mo
SET
  usdt_escrow_amount = public._p2p_btc_amount_to_usdt(mo.btc_escrow_amount),
  locked_take_from_profit = coalesce(mo.locked_take_from_profit, 0),
  locked_take_from_principal = coalesce(mo.locked_take_from_principal, 0)
WHERE mo.side = 'buy_btc'
  AND mo.usdt_escrow_amount IS NULL
  AND mo.btc_escrow_amount IS NOT NULL;

ALTER TABLE public.merchant_orders
  ADD CONSTRAINT merchant_orders_side_amounts_chk CHECK (
    (side = 'sell_usdt'
      AND usdt_credit_amount IS NOT NULL
      AND usdt_escrow_amount IS NULL
      AND btc_credit_amount IS NULL
      AND btc_escrow_amount IS NULL
      AND locked_btc_amount IS NULL
      AND locked_take_from_profit IS NULL
      AND locked_take_from_principal IS NULL)
    OR
    (side = 'sell_btc'
      AND btc_credit_amount IS NOT NULL
      AND usdt_credit_amount IS NULL
      AND usdt_escrow_amount IS NULL
      AND btc_escrow_amount IS NULL
      AND locked_btc_amount IS NULL
      AND locked_take_from_profit IS NULL
      AND locked_take_from_principal IS NULL)
    OR
    (side = 'buy_usdt'
      AND usdt_escrow_amount IS NOT NULL
      AND usdt_credit_amount IS NULL
      AND btc_credit_amount IS NULL
      AND btc_escrow_amount IS NULL
      AND locked_btc_amount IS NULL
      AND locked_take_from_profit IS NOT NULL
      AND locked_take_from_principal IS NOT NULL)
    OR
    (side = 'buy_btc'
      AND btc_escrow_amount IS NOT NULL
      AND locked_btc_amount IS NOT NULL
      AND usdt_escrow_amount IS NOT NULL
      AND locked_take_from_profit IS NOT NULL
      AND locked_take_from_principal IS NOT NULL
      AND usdt_credit_amount IS NULL
      AND btc_credit_amount IS NULL)
  );

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
      withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric + coalesce(p_mo.locked_take_from_profit, 0),
      withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric + coalesce(p_mo.locked_take_from_principal, 0)
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
    withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric + coalesce(p_mo.locked_take_from_profit, 0),
    withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric + coalesce(p_mo.locked_take_from_principal, 0)
  WHERE inv.user_id = p_mo.investor_user_id;

  PERFORM public.sync_investment_plan_from_principal(p_mo.investor_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.withdrawals_before_insert_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  uid uuid := auth.uid();
  inv_row public.investors%ROWTYPE;
  pending_sum numeric := 0;
  avail numeric;
  mo_row public.merchant_orders%ROWTYPE;
  usdt_amt numeric;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NEW.amount IS NULL OR NEW.amount::numeric <= 0 THEN
    RAISE EXCEPTION 'invalid withdrawal amount';
  END IF;

  IF NEW.merchant_order_id IS NOT NULL THEN
    IF current_setting('app.zuno_p2p_withdrawal_pending_insert', true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'p2p withdrawals must be created from the investor release flow';
    END IF;
    IF NEW.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'p2p withdrawal rows must start as pending';
    END IF;

    SELECT * INTO mo_row FROM public.merchant_orders WHERE id = NEW.merchant_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'merchant order not found'; END IF;
    IF mo_row.investor_user_id <> uid THEN RAISE EXCEPTION 'not your p2p order'; END IF;
    IF mo_row.side NOT IN ('buy_usdt', 'buy_btc') OR mo_row.status <> 'paid' THEN
      RAISE EXCEPTION 'invalid p2p order state for withdrawal';
    END IF;

    usdt_amt := public._p2p_order_usdt_escrow(mo_row);
    IF NEW.amount::numeric IS DISTINCT FROM usdt_amt THEN
      RAISE EXCEPTION 'p2p withdrawal amount must match escrow';
    END IF;

    SELECT * INTO inv_row FROM public.investors WHERE user_id = uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'investor profile not found'; END IF;
    IF lower(trim(coalesce(NEW.investor_email, ''))) IS DISTINCT FROM lower(trim(coalesce(inv_row.email, ''))) THEN
      RAISE EXCEPTION 'email mismatch for withdrawal';
    END IF;
    NEW.user_id := uid;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'new withdrawals must start as pending';
  END IF;

  NEW.user_id := uid;
  usdt_amt := public._withdrawal_input_to_usdt(NEW.amount::numeric, NEW.payment_method);

  SELECT * INTO inv_row FROM public.investors WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'investor profile not found'; END IF;
  IF lower(trim(coalesce(NEW.investor_email, ''))) IS DISTINCT FROM lower(trim(coalesce(inv_row.email, ''))) THEN
    RAISE EXCEPTION 'email mismatch for withdrawal';
  END IF;

  SELECT COALESCE(sum(w.amount::numeric), 0)
  INTO pending_sum
  FROM public.withdrawals AS w
  WHERE w.user_id = uid AND w.status = 'pending';

  avail := COALESCE(inv_row.withdrawable_balance, 0)::numeric;

  IF usdt_amt + pending_sum > avail THEN
    RAISE EXCEPTION
      USING errcode = 'check_violation',
        message = 'withdrawal exceeds available withdrawable funds',
        hint = format('usdt_available=%s, pending_total=%s', avail, pending_sum);
  END IF;

  PERFORM public.apply_crypto_withdrawal_deduction(uid, usdt_amt, 'USDT');
  NEW.amount := usdt_amt;
  NEW.ledger_deducted := true;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_withdrawal_core(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  w public.withdrawals%ROWTYPE;
  mo public.merchant_orders%ROWTYPE;
  amt numeric := 0;
BEGIN
  SELECT * INTO w FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdrawal not found'; END IF;
  IF w.status IS DISTINCT FROM 'pending' THEN RETURN; END IF;

  amt := round(coalesce(w.amount::numeric, 0), 8);
  IF amt <= 0 THEN RAISE EXCEPTION 'invalid withdrawal amount'; END IF;

  IF coalesce(w.ledger_deducted, false) THEN
    UPDATE public.withdrawals ww SET status = 'approved' WHERE ww.id = p_withdrawal_id;
    RETURN;
  END IF;

  IF w.merchant_order_id IS NOT NULL THEN
    SELECT * INTO mo FROM public.merchant_orders WHERE id = w.merchant_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'p2p withdrawal references missing merchant order'; END IF;
    IF NOT coalesce(mo.investor_crypto_deducted_at_lock, false) THEN
      PERFORM public.apply_crypto_withdrawal_deduction(w.user_id, amt, 'USDT');
    END IF;
  ELSE
    PERFORM public.apply_crypto_withdrawal_deduction(w.user_id, amt, 'USDT');
  END IF;

  UPDATE public.withdrawals ww
  SET status = 'approved', ledger_deducted = true
  WHERE ww.id = p_withdrawal_id;
END;
$$;

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
  inv public.investors%ROWTYPE;
  take_from_profit numeric;
  take_from_principal numeric;
  remain numeric;
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
  avail_usd := public._p2p_investor_withdrawable_usd(auth.uid());
  IF need_usd > avail_usd THEN
    RAISE EXCEPTION 'insufficient withdrawable balance for this amount';
  END IF;

  amt := round(public._p2p_from_usd(need_usd, asset), 8);
  IF amt <= 0 THEN RAISE EXCEPTION 'invalid converted amount'; END IF;

  usdt_amt := round(public._p2p_from_usd(public._p2p_to_usd(amt, asset), 'USDT'), 8);
  IF usdt_amt <= 0 THEN RAISE EXCEPTION 'invalid usdt escrow amount'; END IF;

  SELECT * INTO inv FROM public.investors WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'investor profile not found'; END IF;

  take_from_profit := LEAST(usdt_amt, greatest(0::numeric, coalesce(inv.withdrawable_profit, 0)));
  remain := usdt_amt - take_from_profit;
  take_from_principal := LEAST(remain, greatest(0::numeric, coalesce(inv.withdrawable_principal, 0)));

  PERFORM public.apply_crypto_withdrawal_deduction(auth.uid(), usdt_amt, 'USDT');

  IF asset = 'BTC' THEN
    INSERT INTO public.merchant_orders (
      investor_user_id, merchant_user_id, offer_id, side, amount_requested,
      rate_percentage, fee_amount, btc_escrow_amount, locked_btc_amount,
      usdt_escrow_amount, locked_take_from_profit, locked_take_from_principal,
      payment_method, investor_payout_instructions, defer_investor_deduction_until_release,
      investor_crypto_deducted_at_lock, status, expires_at,
      fiat_currency_code, fiat_amount, fx_rate_usd_at_open
    )
    VALUES (
      auth.uid(), off.merchant_user_id, off.id, 'buy_btc', amt, off.rate_percentage, 0, amt, amt,
      usdt_amt, take_from_profit, take_from_principal,
      trim(p_payment_method), instr, false, true, 'pending_payment',
      (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 minutes', ccy, fiat_amt, rate_used
    )
    RETURNING id INTO oid;
  ELSE
    INSERT INTO public.merchant_orders (
      investor_user_id, merchant_user_id, offer_id, side, amount_requested,
      rate_percentage, fee_amount, usdt_escrow_amount, locked_take_from_profit,
      locked_take_from_principal, payment_method, investor_payout_instructions,
      defer_investor_deduction_until_release, investor_crypto_deducted_at_lock,
      status, expires_at, fiat_currency_code, fiat_amount, fx_rate_usd_at_open
    )
    VALUES (
      auth.uid(), off.merchant_user_id, off.id, 'buy_usdt', amt, off.rate_percentage, 0, usdt_amt,
      take_from_profit, take_from_principal, trim(p_payment_method), instr, false, true,
      'pending_payment', (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 minutes', ccy, fiat_amt, rate_used
    )
    RETURNING id INTO oid;
  END IF;

  RETURN oid;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_create_merchant_sell_order(uuid, numeric, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_create_merchant_sell_order(uuid, numeric, text, text, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.investor_release_merchant_buy_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  mo public.merchant_orders%ROWTYPE;
  bump numeric;
  n integer;
  inv_email text;
  wid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO mo FROM public.merchant_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF mo.investor_user_id <> auth.uid() THEN RAISE EXCEPTION 'not your order'; END IF;
  IF mo.side NOT IN ('buy_usdt', 'buy_btc') OR mo.status <> 'paid' THEN
    RAISE EXCEPTION 'invalid order state';
  END IF;

  bump := public._p2p_order_usdt_escrow(mo);
  IF bump <= 0 THEN RAISE EXCEPTION 'invalid escrow amount'; END IF;

  SELECT trim(coalesce(email, '')) INTO inv_email
  FROM public.investors
  WHERE user_id = mo.investor_user_id;

  IF trim(coalesce(inv_email, '')) = '' THEN
    RAISE EXCEPTION 'investor email not found';
  END IF;

  PERFORM set_config('app.zuno_p2p_withdrawal_pending_insert', '1', true);

  INSERT INTO public.withdrawals (
    user_id,
    investor_email,
    amount,
    wallet_address,
    payment_method,
    status,
    merchant_order_id,
    ledger_deducted
  )
  VALUES (
    mo.investor_user_id,
    inv_email,
    bump,
    'P2P — settled to merchant',
    'p2p',
    'pending',
    mo.id,
    coalesce(mo.investor_crypto_deducted_at_lock, false)
  )
  RETURNING id INTO wid;

  PERFORM public.approve_withdrawal_core(wid);

  PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);

  UPDATE public.investors inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + bump,
    withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric + bump
  WHERE inv.user_id = mo.merchant_user_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'merchant investor profile not found'; END IF;

  PERFORM public.sync_investment_plan_from_principal(mo.merchant_user_id);

  UPDATE public.merchant_orders mo2
  SET status = 'completed', updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_release_merchant_buy_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_release_merchant_buy_order(uuid) TO authenticated;

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
  UPDATE public.investors inv
  SET balance = coalesce(inv.balance, 0)::numeric + bump,
      locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + bump
  WHERE inv.user_id = mo.investor_user_id;

  until_ts := (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 days';
  INSERT INTO public.principal_locks (deposit_id, user_id, investor_email, principal_amount, locked_until)
  VALUES (dep_id, mo.investor_user_id, inv_email, bump, until_ts);

  sync_uid := mo.investor_user_id;
  PERFORM public.sync_investment_plan_from_principal(sync_uid);

  UPDATE public.merchant_orders mo2
  SET status = 'completed', deposit_id = dep_id, updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.investors_prevent_financial_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF tg_op <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF coalesce(current_setting('app.tp_allow_investor_ledger_mutation', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  NEW.balance := OLD.balance;
  NEW.total_profit := OLD.total_profit;
  NEW.locked_principal_balance := OLD.locked_principal_balance;
  NEW.withdrawable_balance := OLD.withdrawable_balance;
  NEW.withdrawable_profit := OLD.withdrawable_profit;
  NEW.withdrawable_principal := OLD.withdrawable_principal;
  NEW.investment_plan := OLD.investment_plan;
  NEW.tier_manual_override := OLD.tier_manual_override;
  NEW.profit_auto_accrue := OLD.profit_auto_accrue;
  NEW.status := OLD.status;
  NEW.email := OLD.email;
  NEW.user_id := OLD.user_id;
  NEW.last_compound_at := OLD.last_compound_at;

  RETURN NEW;
END;
$$;
