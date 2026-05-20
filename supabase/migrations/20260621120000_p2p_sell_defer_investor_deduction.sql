-- P2P sell (buy_usdt): defer investor balance/profit/principal deduction until investor_release_merchant_buy_order,
-- mirroring approve_withdrawal FIFO logic at release time. Legacy orders (defer=false) keep upfront escrow behavior.

ALTER TABLE public.merchant_orders
  ADD COLUMN IF NOT EXISTS defer_investor_deduction_until_release boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.merchant_orders.defer_investor_deduction_until_release IS
  'When true: investor balances unchanged until release; cancel/expiry needs no restore. When false (legacy): upfront escrow at order create.';

-- Existing rows were created with upfront deduction — keep legacy behavior on cancel/release.
UPDATE public.merchant_orders
SET defer_investor_deduction_until_release = false
WHERE side = 'buy_usdt';

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
  IF coalesce(p_mo.defer_investor_deduction_until_release, false) THEN
    RETURN;
  END IF;

  amt := coalesce(p_mo.usdt_escrow_amount, 0);
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
END;
$$;

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
  pend_p numeric;
  pend_k numeric;
  avail_profit numeric;
  avail_principal numeric;
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
    true,
    'pending_payment',
    (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 minutes'
  )
  RETURNING id INTO oid;

  RETURN oid;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_create_merchant_sell_order(uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_create_merchant_sell_order(uuid, numeric, text, text) TO authenticated;

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

  -- New flow: same FIFO withdrawal ledger as approve_withdrawal (balance + profit/principal buckets)
  IF coalesce(mo.defer_investor_deduction_until_release, false) THEN
    UPDATE public.investors AS inv
    SET
      balance = greatest(0::numeric, coalesce(inv.balance, 0)::numeric - bump),
      withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric - coalesce(mo.locked_take_from_profit, 0),
      withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric - coalesce(mo.locked_take_from_principal, 0)
    WHERE inv.user_id = mo.investor_user_id;

    PERFORM public.sync_investment_plan_from_principal(mo.investor_user_id);
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
