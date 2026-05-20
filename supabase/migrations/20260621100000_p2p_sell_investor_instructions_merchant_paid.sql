-- P2P withdraw/sell flow (buy_usdt orders): investor supplies payout instructions;
-- merchant marks fiat sent (paid); investor releases USDT to merchant (completed).

ALTER TABLE public.merchant_orders
  ADD COLUMN IF NOT EXISTS investor_payout_instructions text;

COMMENT ON COLUMN public.merchant_orders.investor_payout_instructions IS
  'For buy_usdt (investor sell): where/how the investor receives fiat off-platform.';

-- ---------------------------------------------------------------------------
-- Create sell order: require investor payout instructions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.investor_create_merchant_sell_order(
  p_offer_id uuid,
  p_usdt_amount numeric,
  p_payment_method text,
  p_investor_payout_instructions text
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

  instr := trim(coalesce(p_investor_payout_instructions, ''));
  IF instr = '' THEN
    RAISE EXCEPTION 'payment instructions required — tell the merchant how to pay you';
  END IF;

  SELECT * INTO inv
  FROM public.investors
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'investor profile not found';
  END IF;

  take_from_profit := LEAST(amt, coalesce(inv.withdrawable_profit, 0));
  remain := amt - take_from_profit;
  take_from_principal := LEAST(remain, coalesce(inv.withdrawable_principal, 0));

  IF take_from_profit + take_from_principal < amt THEN
    RAISE EXCEPTION 'insufficient withdrawable funds for this amount';
  END IF;

  UPDATE public.investors AS i
  SET
    balance = greatest(0::numeric, coalesce(i.balance, 0)::numeric - amt),
    withdrawable_profit = coalesce(i.withdrawable_profit, 0)::numeric - take_from_profit,
    withdrawable_principal = coalesce(i.withdrawable_principal, 0)::numeric - take_from_principal
  WHERE i.user_id = auth.uid();

  PERFORM public.sync_investment_plan_from_principal(auth.uid());

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
    status,
    expires_at
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
    'pending_payment',
    (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 minutes'
  )
  RETURNING id INTO oid;

  RETURN oid;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_create_merchant_sell_order(uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_create_merchant_sell_order(uuid, numeric, text, text) TO authenticated;

-- Drop old 3-arg signature if present (Postgres allows overload — drop by signature)
DROP FUNCTION IF EXISTS public.investor_create_merchant_sell_order(uuid, numeric, text);

-- Merchant: fiat sent to investor’s instructions → pending_payment → paid
CREATE OR REPLACE FUNCTION public.merchant_mark_buy_order_paid(
  p_order_id uuid,
  p_proof text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'not an active merchant';
  END IF;

  UPDATE public.merchant_orders mo
  SET
    status = 'paid',
    proof_of_payment = NULLIF(trim(coalesce(p_proof, '')), ''),
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo.id = p_order_id
    AND mo.merchant_user_id = auth.uid()
    AND mo.side = 'buy_usdt'
    AND mo.status = 'pending_payment'
    AND mo.expires_at > (NOW() AT TIME ZONE 'UTC');

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'order not updatable';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_mark_buy_order_paid(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_mark_buy_order_paid(uuid, text) TO authenticated;

-- Investor: after merchant marked paid — release escrowed USDT to merchant (ledger complete)
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO mo FROM public.merchant_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF mo.investor_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'not your order';
  END IF;

  IF mo.side <> 'buy_usdt' OR mo.status <> 'paid' THEN
    RAISE EXCEPTION 'invalid order state';
  END IF;

  bump := coalesce(mo.usdt_escrow_amount, 0);
  IF bump <= 0 THEN
    RAISE EXCEPTION 'invalid escrow amount';
  END IF;

  UPDATE public.investors AS inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + bump,
    withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric + bump
  WHERE inv.user_id = mo.merchant_user_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'merchant investor profile not found';
  END IF;

  PERFORM public.sync_investment_plan_from_principal(mo.merchant_user_id);

  UPDATE public.merchant_orders mo2
  SET
    status = 'completed',
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_release_merchant_buy_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_release_merchant_buy_order(uuid) TO authenticated;

-- Remove obsolete direct pending → completed for sell flow
DROP FUNCTION IF EXISTS public.investor_confirm_merchant_sell_paid(uuid);

-- Merchant cannot cancel buy_usdt after marking paid (wait for investor release / support)
CREATE OR REPLACE FUNCTION public.merchant_cancel_merchant_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  mo public.merchant_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'not an active merchant';
  END IF;

  SELECT * INTO mo FROM public.merchant_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF mo.merchant_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'not your order';
  END IF;

  IF mo.side = 'sell_usdt' AND mo.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'cannot cancel after investor marked paid; contact support';
  END IF;

  IF mo.side = 'buy_usdt' AND mo.status = 'paid' THEN
    RAISE EXCEPTION 'cannot cancel after you marked paid — investor must release USDT or contact support';
  END IF;

  IF mo.status <> 'pending_payment' AND mo.status <> 'paid' THEN
    RAISE EXCEPTION 'cannot cancel this order';
  END IF;

  IF mo.side = 'buy_usdt' AND mo.status = 'pending_payment' THEN
    PERFORM public._merchant_restore_sell_escrow(mo);
  END IF;

  UPDATE public.merchant_orders mo2
  SET status = 'cancelled', updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;
END;
$$;
