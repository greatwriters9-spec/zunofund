ALTER TABLE public.merchant_orders
  DROP CONSTRAINT IF EXISTS merchant_orders_status_check;

ALTER TABLE public.merchant_orders
  ADD CONSTRAINT merchant_orders_status_check
    CHECK (status IN ('pending_payment', 'paid', 'completed', 'cancelled', 'completed_expired'));

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

  usdt_amt := round(
    need_usd / greatest(0.0001, (1.0 + coalesce(off.rate_percentage, 0) / 100.0)),
    8
  );
  IF usdt_amt <= 0 THEN RAISE EXCEPTION 'invalid usdt escrow amount'; END IF;

  amt := round(public._p2p_from_usd(public._p2p_to_usd(usdt_amt, 'USDT'), asset), 8);
  IF amt <= 0 THEN RAISE EXCEPTION 'invalid converted amount'; END IF;

  avail_usd := public._p2p_investor_withdrawable_usd(auth.uid());
  IF usdt_amt > avail_usd THEN
    RAISE EXCEPTION 'insufficient withdrawable balance for this amount';
  END IF;

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
    IF r.side IN ('buy_usdt', 'buy_btc') THEN
      PERFORM public._merchant_restore_sell_escrow(r);
    END IF;
    UPDATE public.merchant_orders mo2
      SET status = 'completed_expired', updated_at = (NOW() AT TIME ZONE 'UTC')
      WHERE mo2.id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
