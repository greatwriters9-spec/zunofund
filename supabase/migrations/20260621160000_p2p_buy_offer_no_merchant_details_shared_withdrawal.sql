-- 1) Merchant "Buy USDT" offers: no merchant payment instructions — only methods/rate/limits.
--    Investors supply payout details when opening the sell trade.
-- 2) Shared FIFO deduction used by admin approve_withdrawal and P2P investor_release (defer path).

UPDATE public.merchant_offers
SET payment_instructions = NULL
WHERE side = 'buy_usdt';

CREATE OR REPLACE FUNCTION public.merchant_create_offer(
  p_side text,
  p_payment_methods text[],
  p_min_limit numeric,
  p_max_limit numeric,
  p_rate_percentage numeric,
  p_payment_instructions text DEFAULT NULL
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
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'not an active merchant';
  END IF;

  IF p_side NOT IN ('sell_usdt', 'buy_usdt') THEN
    RAISE EXCEPTION 'invalid side';
  END IF;

  IF p_min_limit IS NULL OR p_max_limit IS NULL OR p_min_limit < 0 OR p_max_limit < p_min_limit THEN
    RAISE EXCEPTION 'invalid limits';
  END IF;

  IF p_side = 'buy_usdt' THEN
    instr := NULL;
  ELSE
    instr := NULLIF(trim(coalesce(p_payment_instructions, '')), '');
  END IF;

  INSERT INTO public.merchant_offers (
    merchant_user_id,
    side,
    payment_methods,
    min_limit,
    max_limit,
    rate_percentage,
    payment_instructions,
    status
  )
  VALUES (
    auth.uid(),
    p_side,
    coalesce(p_payment_methods, '{}'),
    p_min_limit,
    p_max_limit,
    coalesce(p_rate_percentage, 0),
    instr,
    'active'
  )
  RETURNING id INTO nid;

  RETURN nid;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_create_offer(text, text[], numeric, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_create_offer(text, text[], numeric, numeric, numeric, text) TO authenticated;

-- Exact same FIFO math + investor row match as approve_withdrawal (lines 512–521, 516–522).
CREATE OR REPLACE FUNCTION public.apply_withdrawal_fifo_deduction(p_user_id uuid, p_amount numeric)
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
  amt := coalesce(p_amount, 0);
  IF amt <= 0 THEN
    RAISE EXCEPTION 'invalid withdrawal amount';
  END IF;

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

REVOKE ALL ON FUNCTION public.apply_withdrawal_fifo_deduction(uuid, numeric) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  w public.withdrawals%ROWTYPE;
  amt numeric := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT *
  INTO w
  FROM public.withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal not found';
  END IF;

  IF w.status IS DISTINCT FROM 'pending' THEN
    RETURN;
  END IF;

  amt := coalesce(w.amount::numeric, 0);

  PERFORM public.apply_withdrawal_fifo_deduction(w.user_id, amt);

  UPDATE public.withdrawals
  SET status = 'approved'
  WHERE id = p_withdrawal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_withdrawal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid) TO authenticated;

-- P2P release: use apply_withdrawal_fifo_deduction for defer orders (same as exchange approval).
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

  SELECT trim(coalesce(email, '')) INTO inv_email
  FROM public.investors
  WHERE user_id = mo.investor_user_id;

  IF trim(coalesce(inv_email, '')) = '' THEN
    RAISE EXCEPTION 'investor email not found';
  END IF;

  IF coalesce(mo.defer_investor_deduction_until_release, false) THEN
    PERFORM public.apply_withdrawal_fifo_deduction(mo.investor_user_id, bump);
  END IF;

  PERFORM set_config('app.zuno_p2p_withdrawal_insert', '1', true);

  INSERT INTO public.withdrawals (
    user_id,
    investor_email,
    amount,
    wallet_address,
    payment_method,
    status,
    merchant_order_id
  )
  VALUES (
    mo.investor_user_id,
    inv_email,
    bump,
    'P2P — settled to merchant',
    'p2p',
    'approved',
    mo.id
  );

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

  UPDATE public.merchant_orders AS mo2
  SET
    status = 'completed',
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_release_merchant_buy_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_release_merchant_buy_order(uuid) TO authenticated;
