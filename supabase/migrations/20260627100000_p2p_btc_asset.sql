-- Phase 4: BTC P2P alongside USDT. Remove ETH from scope.

DELETE FROM public.exchange_rates WHERE code = 'ETH';

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS btc_balance numeric NOT NULL DEFAULT 0;

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS btc_withdrawable numeric NOT NULL DEFAULT 0;

ALTER TABLE public.investors
  DROP CONSTRAINT IF EXISTS investors_btc_balance_chk;
ALTER TABLE public.investors
  ADD CONSTRAINT investors_btc_balance_chk CHECK (btc_balance >= 0);

ALTER TABLE public.investors
  DROP CONSTRAINT IF EXISTS investors_btc_withdrawable_chk;
ALTER TABLE public.investors
  ADD CONSTRAINT investors_btc_withdrawable_chk CHECK (btc_withdrawable >= 0);

ALTER TABLE public.merchant_offers
  DROP CONSTRAINT IF EXISTS merchant_offers_side_check;
ALTER TABLE public.merchant_offers
  ADD CONSTRAINT merchant_offers_side_check
    CHECK (side IN ('sell_usdt', 'buy_usdt', 'sell_btc', 'buy_btc'));

ALTER TABLE public.merchant_orders
  ADD COLUMN IF NOT EXISTS btc_credit_amount numeric;

ALTER TABLE public.merchant_orders
  ADD COLUMN IF NOT EXISTS btc_escrow_amount numeric;

ALTER TABLE public.merchant_orders
  ADD COLUMN IF NOT EXISTS locked_btc_amount numeric;

ALTER TABLE public.merchant_orders
  DROP CONSTRAINT IF EXISTS merchant_orders_side_check;
ALTER TABLE public.merchant_orders
  DROP CONSTRAINT IF EXISTS merchant_orders_side_amounts_chk;

ALTER TABLE public.merchant_orders
  ADD CONSTRAINT merchant_orders_side_check
    CHECK (side IN ('sell_usdt', 'buy_usdt', 'sell_btc', 'buy_btc'));

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
      AND usdt_credit_amount IS NULL
      AND usdt_escrow_amount IS NULL
      AND btc_credit_amount IS NULL
      AND locked_take_from_profit IS NULL
      AND locked_take_from_principal IS NULL)
  );

-- ---------------------------------------------------------------------------
-- merchant_create_offer: USDT + BTC sides
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.merchant_create_offer(text, text[], numeric, numeric, numeric, text, text, text);

CREATE FUNCTION public.merchant_create_offer(
  p_side text,
  p_payment_methods text[],
  p_min_limit numeric,
  p_max_limit numeric,
  p_rate_percentage numeric,
  p_payment_instructions text DEFAULT NULL,
  p_advert_message text DEFAULT NULL,
  p_fiat_currency_code text DEFAULT 'USD'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  nid uuid;
  instr text;
  advert text;
  ccy text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'not an active merchant';
  END IF;

  IF p_side NOT IN ('sell_usdt', 'buy_usdt', 'sell_btc', 'buy_btc') THEN
    RAISE EXCEPTION 'invalid side';
  END IF;

  IF p_min_limit IS NULL OR p_max_limit IS NULL OR p_min_limit < 0 OR p_max_limit < p_min_limit THEN
    RAISE EXCEPTION 'invalid limits';
  END IF;

  ccy := upper(coalesce(nullif(trim(p_fiat_currency_code), ''), 'USD'));
  IF length(ccy) <> 3 THEN
    RAISE EXCEPTION 'invalid fiat currency code: %', ccy;
  END IF;

  IF p_side IN ('buy_usdt', 'buy_btc') THEN
    instr := NULL;
  ELSE
    instr := NULLIF(trim(coalesce(p_payment_instructions, '')), '');
  END IF;

  advert := NULLIF(left(trim(coalesce(p_advert_message, '')), 500), '');

  INSERT INTO public.merchant_offers (
    merchant_user_id, side, payment_methods, min_limit, max_limit,
    rate_percentage, payment_instructions, advert_message, fiat_currency_code, status
  )
  VALUES (
    auth.uid(), p_side, coalesce(p_payment_methods, '{}'), p_min_limit, p_max_limit,
    coalesce(p_rate_percentage, 0), instr, advert, ccy, 'active'
  )
  RETURNING id INTO nid;

  RETURN nid;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_create_offer(text, text[], numeric, numeric, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_create_offer(text, text[], numeric, numeric, numeric, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- investor_create_merchant_buy_order: sell_usdt + sell_btc
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.investor_create_merchant_buy_order(uuid, numeric, text, numeric);

CREATE FUNCTION public.investor_create_merchant_buy_order(
  p_offer_id uuid,
  p_amount_requested numeric,
  p_payment_method text,
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
  fee numeric;
  credit numeric;
  oid uuid;
  ccy text;
  rate_used numeric;
  fiat_amt numeric;
  is_btc boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO off FROM public.merchant_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'offer not found'; END IF;

  is_btc := off.side = 'sell_btc';

  IF off.status <> 'active' OR off.side NOT IN ('sell_usdt', 'sell_btc') THEN
    RAISE EXCEPTION 'invalid offer';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.merchant_profiles mp
    WHERE mp.user_id = off.merchant_user_id AND mp.status = 'active'
  ) THEN
    RAISE EXCEPTION 'merchant inactive';
  END IF;

  IF public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'merchants cannot place buy orders from investor flows';
  END IF;

  IF p_amount_requested IS NULL OR p_amount_requested <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF p_amount_requested < off.min_limit OR p_amount_requested > off.max_limit THEN
    RAISE EXCEPTION 'amount outside offer limits';
  END IF;
  IF trim(coalesce(p_payment_method, '')) = '' THEN RAISE EXCEPTION 'payment method required'; END IF;
  IF NOT (p_payment_method = ANY (off.payment_methods)) THEN
    RAISE EXCEPTION 'payment method not accepted by this offer';
  END IF;

  fee := round(p_amount_requested * (coalesce(off.rate_percentage, 0) / 100.0), 8);
  credit := round(p_amount_requested - fee, 8);
  IF credit <= 0 THEN RAISE EXCEPTION 'credit amount must be positive after fees'; END IF;

  ccy := coalesce(nullif(trim(off.fiat_currency_code), ''), 'USD');
  IF p_fx_rate_usd_at_open IS NOT NULL AND p_fx_rate_usd_at_open > 0 THEN
    rate_used := p_fx_rate_usd_at_open;
  ELSE
    SELECT er.usd_value INTO rate_used FROM public.exchange_rates er WHERE er.code = ccy;
    IF rate_used IS NULL OR rate_used <= 0 THEN rate_used := 1; END IF;
  END IF;
  fiat_amt := round(credit / rate_used, 4);

  IF is_btc THEN
    INSERT INTO public.merchant_orders (
      investor_user_id, merchant_user_id, offer_id, side, amount_requested,
      rate_percentage, fee_amount, btc_credit_amount, payment_method, status, expires_at,
      fiat_currency_code, fiat_amount, fx_rate_usd_at_open
    )
    VALUES (
      auth.uid(), off.merchant_user_id, off.id, 'sell_btc', p_amount_requested,
      off.rate_percentage, fee, credit, trim(p_payment_method), 'pending_payment',
      (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 minutes', ccy, fiat_amt, rate_used
    )
    RETURNING id INTO oid;
  ELSE
    INSERT INTO public.merchant_orders (
      investor_user_id, merchant_user_id, offer_id, side, amount_requested,
      rate_percentage, fee_amount, usdt_credit_amount, payment_method, status, expires_at,
      fiat_currency_code, fiat_amount, fx_rate_usd_at_open
    )
    VALUES (
      auth.uid(), off.merchant_user_id, off.id, 'sell_usdt', p_amount_requested,
      off.rate_percentage, fee, credit, trim(p_payment_method), 'pending_payment',
      (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 minutes', ccy, fiat_amt, rate_used
    )
    RETURNING id INTO oid;
  END IF;

  RETURN oid;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_create_merchant_buy_order(uuid, numeric, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_create_merchant_buy_order(uuid, numeric, text, numeric) TO authenticated;

-- ---------------------------------------------------------------------------
-- investor_create_merchant_sell_order: buy_usdt + buy_btc
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.investor_create_merchant_sell_order(uuid, numeric, text, text, numeric);

CREATE FUNCTION public.investor_create_merchant_sell_order(
  p_offer_id uuid,
  p_usdt_amount numeric,
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
  oid uuid;
  instr text;
  pend_p numeric;
  pend_k numeric;
  pend_btc numeric;
  avail_profit numeric;
  avail_principal numeric;
  avail_btc numeric;
  ccy text;
  rate_used numeric;
  fiat_amt numeric;
  is_btc boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'merchants cannot open investor sell orders';
  END IF;

  SELECT * INTO off FROM public.merchant_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'offer not found'; END IF;

  is_btc := off.side = 'buy_btc';

  IF off.status <> 'active' OR off.side NOT IN ('buy_usdt', 'buy_btc') THEN
    RAISE EXCEPTION 'invalid offer';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.merchant_profiles mp
    WHERE mp.user_id = off.merchant_user_id AND mp.status = 'active'
  ) THEN
    RAISE EXCEPTION 'merchant inactive';
  END IF;

  amt := round(coalesce(p_usdt_amount, 0), 8);
  IF amt <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF amt < off.min_limit OR amt > off.max_limit THEN RAISE EXCEPTION 'amount outside offer limits'; END IF;
  IF trim(coalesce(p_payment_method, '')) = '' THEN RAISE EXCEPTION 'payment method required'; END IF;
  IF NOT (p_payment_method = ANY (off.payment_methods)) THEN
    RAISE EXCEPTION 'payment method not accepted by this offer';
  END IF;

  instr := nullif(trim(coalesce(p_investor_payout_instructions, '')), '');

  SELECT * INTO inv FROM public.investors WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'investor profile not found'; END IF;

  IF is_btc THEN
    SELECT coalesce(sum(mo.locked_btc_amount), 0) INTO pend_btc
    FROM public.merchant_orders mo
    WHERE mo.investor_user_id = auth.uid()
      AND mo.side = 'buy_btc'
      AND mo.defer_investor_deduction_until_release = true
      AND mo.status IN ('pending_payment', 'paid');

    avail_btc := coalesce(inv.btc_withdrawable, 0)::numeric - pend_btc;
    IF amt > greatest(0::numeric, avail_btc) THEN
      RAISE EXCEPTION 'insufficient withdrawable BTC for this amount';
    END IF;
  ELSE
    SELECT
      coalesce(sum(mo.locked_take_from_profit), 0),
      coalesce(sum(mo.locked_take_from_principal), 0)
    INTO pend_p, pend_k
    FROM public.merchant_orders mo
    WHERE mo.investor_user_id = auth.uid()
      AND mo.side = 'buy_usdt'
      AND mo.defer_investor_deduction_until_release = true
      AND mo.status IN ('pending_payment', 'paid');

    avail_profit := coalesce(inv.withdrawable_profit, 0)::numeric - pend_p;
    avail_principal := coalesce(inv.withdrawable_principal, 0)::numeric - pend_k;
    take_from_profit := LEAST(amt, greatest(0::numeric, avail_profit));
    remain := amt - take_from_profit;
    take_from_principal := LEAST(remain, greatest(0::numeric, avail_principal));
    IF take_from_profit + take_from_principal < amt THEN
      RAISE EXCEPTION 'insufficient withdrawable funds for this amount';
    END IF;
  END IF;

  ccy := coalesce(nullif(trim(off.fiat_currency_code), ''), 'USD');
  IF p_fx_rate_usd_at_open IS NOT NULL AND p_fx_rate_usd_at_open > 0 THEN
    rate_used := p_fx_rate_usd_at_open;
  ELSE
    SELECT er.usd_value INTO rate_used FROM public.exchange_rates er WHERE er.code = ccy;
    IF rate_used IS NULL OR rate_used <= 0 THEN rate_used := 1; END IF;
  END IF;
  fiat_amt := round(amt / rate_used, 4);

  IF is_btc THEN
    INSERT INTO public.merchant_orders (
      investor_user_id, merchant_user_id, offer_id, side, amount_requested,
      rate_percentage, fee_amount, btc_escrow_amount, locked_btc_amount,
      payment_method, investor_payout_instructions, defer_investor_deduction_until_release,
      status, expires_at, fiat_currency_code, fiat_amount, fx_rate_usd_at_open
    )
    VALUES (
      auth.uid(), off.merchant_user_id, off.id, 'buy_btc', amt, off.rate_percentage, 0, amt, amt,
      trim(p_payment_method), instr, true, 'pending_payment',
      (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 minutes', ccy, fiat_amt, rate_used
    )
    RETURNING id INTO oid;
  ELSE
    INSERT INTO public.merchant_orders (
      investor_user_id, merchant_user_id, offer_id, side, amount_requested,
      rate_percentage, fee_amount, usdt_escrow_amount, locked_take_from_profit,
      locked_take_from_principal, payment_method, investor_payout_instructions,
      defer_investor_deduction_until_release, status, expires_at,
      fiat_currency_code, fiat_amount, fx_rate_usd_at_open
    )
    VALUES (
      auth.uid(), off.merchant_user_id, off.id, 'buy_usdt', amt, off.rate_percentage, 0, amt,
      take_from_profit, take_from_principal, trim(p_payment_method), instr, true,
      'pending_payment', (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 minutes', ccy, fiat_amt, rate_used
    )
    RETURNING id INTO oid;
  END IF;

  RETURN oid;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_create_merchant_sell_order(uuid, numeric, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_create_merchant_sell_order(uuid, numeric, text, text, numeric) TO authenticated;

-- ---------------------------------------------------------------------------
-- Restore / release helpers for BTC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._merchant_restore_btc_sell_escrow(p_mo public.merchant_orders)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  amt numeric;
BEGIN
  amt := coalesce(p_mo.locked_btc_amount, 0);
  IF amt <= 0 THEN RETURN; END IF;
  -- No balance was deducted yet when defer_investor_deduction_until_release is true.
END;
$$;

CREATE OR REPLACE FUNCTION public.investor_mark_merchant_order_paid(p_order_id uuid, p_proof text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.merchant_orders mo
  SET status = 'paid', proof_of_payment = NULLIF(trim(coalesce(p_proof, '')), ''),
      updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo.id = p_order_id AND mo.investor_user_id = auth.uid()
    AND mo.side IN ('sell_usdt', 'sell_btc') AND mo.status = 'pending_payment'
    AND mo.expires_at > (NOW() AT TIME ZONE 'UTC');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'order not updatable'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.merchant_mark_buy_order_paid(p_order_id uuid, p_proof text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'not an active merchant';
  END IF;
  UPDATE public.merchant_orders mo
  SET status = 'paid', proof_of_payment = NULLIF(trim(coalesce(p_proof, '')), ''),
      updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo.id = p_order_id AND mo.merchant_user_id = auth.uid()
    AND mo.side IN ('buy_usdt', 'buy_btc') AND mo.status = 'pending_payment'
    AND mo.expires_at > (NOW() AT TIME ZONE 'UTC');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'order not updatable'; END IF;
END;
$$;

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

  IF mo.side = 'sell_btc' THEN
    bump := coalesce(mo.btc_credit_amount, 0);
    IF bump <= 0 THEN RAISE EXCEPTION 'invalid credit amount'; END IF;
    UPDATE public.investors inv
    SET
      btc_balance = coalesce(inv.btc_balance, 0)::numeric + bump,
      btc_withdrawable = coalesce(inv.btc_withdrawable, 0)::numeric + bump
    WHERE inv.user_id = mo.investor_user_id;
    UPDATE public.merchant_orders mo2
    SET status = 'completed', updated_at = (NOW() AT TIME ZONE 'UTC')
    WHERE mo2.id = mo.id;
    RETURN;
  END IF;

  bump := coalesce(mo.usdt_credit_amount, 0);
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

-- investor_release_merchant_buy_order: see 20260629120000_fix_investor_release_buy_order.sql

-- Cancel rules live in 20260628100000_payer_cancel_after_paid.sql

CREATE OR REPLACE FUNCTION public.merchant_expire_stale_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE n integer := 0;
  r public.merchant_orders%ROWTYPE;
BEGIN
  FOR r IN
    SELECT * FROM public.merchant_orders mo
    WHERE mo.status = 'pending_payment' AND mo.expires_at <= (NOW() AT TIME ZONE 'UTC')
    FOR UPDATE
  LOOP
    IF r.side = 'buy_usdt' THEN PERFORM public._merchant_restore_sell_escrow(r); END IF;
    UPDATE public.merchant_orders mo2 SET status = 'cancelled', updated_at = (NOW() AT TIME ZONE 'UTC') WHERE mo2.id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
