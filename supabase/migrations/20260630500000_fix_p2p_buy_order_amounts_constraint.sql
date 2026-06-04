-- Fix investor buy flow: sell_usdt/sell_btc orders must leave lock columns NULL.
-- locked_take_from_locked_principal defaults to 0, which violates merchant_orders_side_amounts_chk.

CREATE OR REPLACE FUNCTION public.investor_create_merchant_buy_order(
  p_offer_id uuid,
  p_fiat_amount numeric,
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
  asset text;
  crypto_amt numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO off FROM public.merchant_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'offer not found';
  END IF;

  IF off.merchant_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot trade on your own offer';
  END IF;

  asset := public._p2p_asset_from_side(off.side);

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

  fiat_amt := round(coalesce(p_fiat_amount, 0), 4);
  IF fiat_amt <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  ccy := coalesce(nullif(trim(off.fiat_currency_code), ''), 'USD');
  IF fiat_amt < off.min_limit OR fiat_amt > off.max_limit THEN
    RAISE EXCEPTION 'amount outside offer limits';
  END IF;

  IF trim(coalesce(p_payment_method, '')) = '' THEN
    RAISE EXCEPTION 'payment method required';
  END IF;
  IF NOT (p_payment_method = ANY (off.payment_methods)) THEN
    RAISE EXCEPTION 'payment method not accepted by this offer';
  END IF;

  IF p_fx_rate_usd_at_open IS NOT NULL AND p_fx_rate_usd_at_open > 0 THEN
    rate_used := p_fx_rate_usd_at_open;
  ELSE
    rate_used := public._p2p_usd_per_unit(ccy);
  END IF;

  crypto_amt := round(public._p2p_from_usd(public._p2p_to_usd(fiat_amt, ccy), asset), 8);
  IF crypto_amt <= 0 THEN
    RAISE EXCEPTION 'invalid converted amount';
  END IF;

  fee := round(crypto_amt * (coalesce(off.rate_percentage, 0) / 100.0), 8);
  credit := round(crypto_amt - fee, 8);
  IF credit <= 0 THEN
    RAISE EXCEPTION 'credit amount must be positive after fees';
  END IF;

  IF asset = 'BTC' THEN
    INSERT INTO public.merchant_orders (
      investor_user_id,
      merchant_user_id,
      offer_id,
      side,
      amount_requested,
      rate_percentage,
      fee_amount,
      btc_credit_amount,
      usdt_credit_amount,
      usdt_escrow_amount,
      btc_escrow_amount,
      locked_btc_amount,
      locked_take_from_profit,
      locked_take_from_principal,
      locked_take_from_locked_principal,
      payment_method,
      status,
      expires_at,
      fiat_currency_code,
      fiat_amount,
      fx_rate_usd_at_open
    )
    VALUES (
      auth.uid(),
      off.merchant_user_id,
      off.id,
      'sell_btc',
      crypto_amt,
      off.rate_percentage,
      fee,
      credit,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      trim(p_payment_method),
      'pending_payment',
      (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 minutes',
      ccy,
      fiat_amt,
      rate_used
    )
    RETURNING id INTO oid;
  ELSE
    INSERT INTO public.merchant_orders (
      investor_user_id,
      merchant_user_id,
      offer_id,
      side,
      amount_requested,
      rate_percentage,
      fee_amount,
      usdt_credit_amount,
      usdt_escrow_amount,
      btc_credit_amount,
      btc_escrow_amount,
      locked_btc_amount,
      locked_take_from_profit,
      locked_take_from_principal,
      locked_take_from_locked_principal,
      payment_method,
      status,
      expires_at,
      fiat_currency_code,
      fiat_amount,
      fx_rate_usd_at_open
    )
    VALUES (
      auth.uid(),
      off.merchant_user_id,
      off.id,
      'sell_usdt',
      crypto_amt,
      off.rate_percentage,
      fee,
      credit,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      trim(p_payment_method),
      'pending_payment',
      (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 minutes',
      ccy,
      fiat_amt,
      rate_used
    )
    RETURNING id INTO oid;
  END IF;

  RETURN oid;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_create_merchant_buy_order(uuid, numeric, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_create_merchant_buy_order(uuid, numeric, text, numeric) TO authenticated;
