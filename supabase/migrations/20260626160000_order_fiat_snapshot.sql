-- Phase 3: snapshot the fiat amount/currency/rate on each merchant_order at
-- creation time. Locks the rate as of order open so neither party drifts if
-- exchange rates move during the 30-minute window.

ALTER TABLE public.merchant_orders
  ADD COLUMN IF NOT EXISTS fiat_currency_code text;

ALTER TABLE public.merchant_orders
  ADD COLUMN IF NOT EXISTS fiat_amount numeric;

ALTER TABLE public.merchant_orders
  ADD COLUMN IF NOT EXISTS fx_rate_usd_at_open numeric;

ALTER TABLE public.merchant_orders
  DROP CONSTRAINT IF EXISTS merchant_orders_fiat_currency_code_chk;
ALTER TABLE public.merchant_orders
  ADD CONSTRAINT merchant_orders_fiat_currency_code_chk
    CHECK (
      fiat_currency_code IS NULL
      OR (fiat_currency_code = upper(fiat_currency_code) AND length(fiat_currency_code) = 3)
    );

ALTER TABLE public.merchant_orders
  DROP CONSTRAINT IF EXISTS merchant_orders_fiat_amount_chk;
ALTER TABLE public.merchant_orders
  ADD CONSTRAINT merchant_orders_fiat_amount_chk
    CHECK (fiat_amount IS NULL OR fiat_amount >= 0);

ALTER TABLE public.merchant_orders
  DROP CONSTRAINT IF EXISTS merchant_orders_fx_rate_chk;
ALTER TABLE public.merchant_orders
  ADD CONSTRAINT merchant_orders_fx_rate_chk
    CHECK (fx_rate_usd_at_open IS NULL OR fx_rate_usd_at_open > 0);

COMMENT ON COLUMN public.merchant_orders.fiat_currency_code IS
  'Snapshot of the offer''s fiat code at order open. NULL on legacy rows (treated as USD).';
COMMENT ON COLUMN public.merchant_orders.fiat_amount IS
  'Off-platform fiat amount the parties agreed to settle, in fiat_currency_code. Derived from usdt amount / fx_rate_usd_at_open.';
COMMENT ON COLUMN public.merchant_orders.fx_rate_usd_at_open IS
  'USD value of one unit of fiat_currency_code at order creation. Stays fixed for the lifetime of the order.';

-- Backfill existing orders from their offer''s currency at the prevailing
-- cached rate. Legacy rows without a matching offer/rate fall back to USD 1:1.
UPDATE public.merchant_orders mo
SET
  fiat_currency_code = coalesce(mo.fiat_currency_code, off.fiat_currency_code, 'USD'),
  fx_rate_usd_at_open = coalesce(
    mo.fx_rate_usd_at_open,
    (SELECT er.usd_value FROM public.exchange_rates er WHERE er.code = coalesce(off.fiat_currency_code, 'USD')),
    1
  ),
  fiat_amount = coalesce(
    mo.fiat_amount,
    round(
      mo.amount_requested / coalesce(
        (SELECT er.usd_value FROM public.exchange_rates er WHERE er.code = coalesce(off.fiat_currency_code, 'USD')),
        1
      ),
      4
    )
  )
FROM public.merchant_offers off
WHERE mo.offer_id = off.id
  AND (mo.fiat_currency_code IS NULL OR mo.fx_rate_usd_at_open IS NULL OR mo.fiat_amount IS NULL);

UPDATE public.merchant_orders
SET
  fiat_currency_code = coalesce(fiat_currency_code, 'USD'),
  fx_rate_usd_at_open = coalesce(fx_rate_usd_at_open, 1),
  fiat_amount = coalesce(fiat_amount, amount_requested)
WHERE fiat_currency_code IS NULL OR fx_rate_usd_at_open IS NULL OR fiat_amount IS NULL;

-- ---------------------------------------------------------------------------
-- investor_create_merchant_buy_order: now accepts an optional FX-rate snapshot
-- so the client can lock its visible rate. If omitted, fall back to the live
-- exchange_rates cache; final fallback is 1 (USD).
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.investor_create_merchant_buy_order(uuid, numeric, text);
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
AS $function$
DECLARE
  off public.merchant_offers%ROWTYPE;
  fee numeric;
  credit numeric;
  oid uuid;
  ccy text;
  rate_used numeric;
  fiat_amt numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO off FROM public.merchant_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'offer not found';
  END IF;

  IF off.status <> 'active' OR off.side <> 'sell_usdt' THEN
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

  IF p_amount_requested IS NULL OR p_amount_requested <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  IF p_amount_requested < off.min_limit OR p_amount_requested > off.max_limit THEN
    RAISE EXCEPTION 'amount outside offer limits';
  END IF;

  IF trim(coalesce(p_payment_method, '')) = '' THEN
    RAISE EXCEPTION 'payment method required';
  END IF;

  IF NOT (p_payment_method = ANY (off.payment_methods)) THEN
    RAISE EXCEPTION 'payment method not accepted by this offer';
  END IF;

  fee := round(p_amount_requested * (coalesce(off.rate_percentage, 0) / 100.0), 8);
  credit := round(p_amount_requested - fee, 8);

  IF credit <= 0 THEN
    RAISE EXCEPTION 'credit amount must be positive after fees';
  END IF;

  ccy := coalesce(nullif(trim(off.fiat_currency_code), ''), 'USD');
  IF p_fx_rate_usd_at_open IS NOT NULL AND p_fx_rate_usd_at_open > 0 THEN
    rate_used := p_fx_rate_usd_at_open;
  ELSE
    SELECT er.usd_value INTO rate_used FROM public.exchange_rates er WHERE er.code = ccy;
    IF rate_used IS NULL OR rate_used <= 0 THEN rate_used := 1; END IF;
  END IF;
  -- Snapshot the buyer's net fiat outlay (USDT credit / rate) — that's the
  -- amount that actually moves off-platform from buyer to merchant.
  fiat_amt := round(credit / rate_used, 4);

  INSERT INTO public.merchant_orders (
    investor_user_id,
    merchant_user_id,
    offer_id,
    side,
    amount_requested,
    rate_percentage,
    fee_amount,
    usdt_credit_amount,
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
    p_amount_requested,
    off.rate_percentage,
    fee,
    credit,
    trim(p_payment_method),
    'pending_payment',
    (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 minutes',
    ccy,
    fiat_amt,
    rate_used
  )
  RETURNING id INTO oid;

  RETURN oid;
END;
$function$;

REVOKE ALL ON FUNCTION public.investor_create_merchant_buy_order(uuid, numeric, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_create_merchant_buy_order(uuid, numeric, text, numeric) TO authenticated;

-- ---------------------------------------------------------------------------
-- investor_create_merchant_sell_order: same snapshot pattern.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.investor_create_merchant_sell_order(uuid, numeric, text, text);
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
AS $function$
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
  avail_profit numeric;
  avail_principal numeric;
  ccy text;
  rate_used numeric;
  fiat_amt numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'merchants cannot open investor sell orders';
  END IF;

  SELECT * INTO off FROM public.merchant_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'offer not found';
  END IF;

  IF off.status <> 'active' OR off.side <> 'buy_usdt' THEN
    RAISE EXCEPTION 'invalid offer';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.merchant_profiles mp
    WHERE mp.user_id = off.merchant_user_id AND mp.status = 'active'
  ) THEN
    RAISE EXCEPTION 'merchant inactive';
  END IF;

  amt := round(coalesce(p_usdt_amount, 0), 8);

  IF amt <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  IF amt < off.min_limit OR amt > off.max_limit THEN
    RAISE EXCEPTION 'amount outside offer limits';
  END IF;

  IF trim(coalesce(p_payment_method, '')) = '' THEN
    RAISE EXCEPTION 'payment method required';
  END IF;

  IF NOT (p_payment_method = ANY (off.payment_methods)) THEN
    RAISE EXCEPTION 'payment method not accepted by this offer';
  END IF;

  instr := nullif(trim(coalesce(p_investor_payout_instructions, '')), '');

  SELECT * INTO inv FROM public.investors WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'investor profile not found';
  END IF;

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

  ccy := coalesce(nullif(trim(off.fiat_currency_code), ''), 'USD');
  IF p_fx_rate_usd_at_open IS NOT NULL AND p_fx_rate_usd_at_open > 0 THEN
    rate_used := p_fx_rate_usd_at_open;
  ELSE
    SELECT er.usd_value INTO rate_used FROM public.exchange_rates er WHERE er.code = ccy;
    IF rate_used IS NULL OR rate_used <= 0 THEN rate_used := 1; END IF;
  END IF;
  -- Investor sells USDT and receives fiat; snapshot the gross fiat amount
  -- (their expected receipt). Fee is settled in USDT terms by the merchant.
  fiat_amt := round(amt / rate_used, 4);

  INSERT INTO public.merchant_orders (
    investor_user_id,
    merchant_user_id,
    offer_id,
    side,
    amount_requested,
    rate_percentage,
    fee_amount,
    usdt_escrow_amount,
    locked_take_from_profit,
    locked_take_from_principal,
    payment_method,
    investor_payout_instructions,
    defer_investor_deduction_until_release,
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
    'buy_usdt',
    amt,
    off.rate_percentage,
    0,
    amt,
    take_from_profit,
    take_from_principal,
    trim(p_payment_method),
    instr,
    true,
    'pending_payment',
    (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 minutes',
    ccy,
    fiat_amt,
    rate_used
  )
  RETURNING id INTO oid;

  RETURN oid;
END;
$function$;

REVOKE ALL ON FUNCTION public.investor_create_merchant_sell_order(uuid, numeric, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_create_merchant_sell_order(uuid, numeric, text, text, numeric) TO authenticated;
