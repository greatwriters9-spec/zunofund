-- P2P sell: profits only (locked + matured principal stay locked, same policy as wallet).
-- Replaces full-balance / locked-principal P2P deduction on production.

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
    coalesce(inv.withdrawable_profit, 0)::numeric - pend_usd
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._p2p_investor_sellable_usd(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
  SELECT public._p2p_investor_withdrawable_usd(p_user_id);
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

  IF take_from_profit < amt THEN
    RAISE EXCEPTION 'insufficient withdrawable profit for p2p sell';
  END IF;

  UPDATE public.investors AS inv
  SET
    balance = greatest(0::numeric, coalesce(inv.balance, 0)::numeric - amt),
    withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric - take_from_profit
  WHERE inv.user_id = p_user_id
     OR lower(trim(inv.email)) = lower(trim(inv_row.email));

  PERFORM public.sync_investment_plan_from_principal(inv_row.user_id);
END;
$$;

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
      'withdrawable_profit_usd', 0,
      'withdrawable_principal_usd', 0
    );
  END IF;

  RETURN jsonb_build_object(
    'portfolio_usd', coalesce(inv.balance, 0),
    'sellable_usd', public._p2p_investor_withdrawable_usd(auth.uid()),
    'wallet_withdrawable_usd', coalesce(inv.withdrawable_balance, 0),
    'locked_principal_usd', coalesce(inv.locked_principal_balance, 0),
    'withdrawable_profit_usd', coalesce(inv.withdrawable_profit, 0),
    'withdrawable_principal_usd', coalesce(inv.withdrawable_principal, 0)
  );
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
    RAISE EXCEPTION 'insufficient withdrawable profit for p2p sell';
  END IF;

  SELECT * INTO inv FROM public.investors WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'investor profile not found'; END IF;

  IF usdt_amt > coalesce(inv.withdrawable_profit, 0) THEN
    RAISE EXCEPTION 'insufficient withdrawable profit for p2p sell';
  END IF;

  SELECT r.take_from_profit, r.take_from_principal
  INTO take_from_profit, take_from_principal
  FROM public.apply_p2p_sell_crypto_deduction(auth.uid(), usdt_amt) AS r;

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
      usdt_amt, take_from_profit, 0, 0,
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
      take_from_profit, 0, 0,
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

REVOKE ALL ON FUNCTION public.investor_p2p_sellable_balances() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_p2p_sellable_balances() TO authenticated;
