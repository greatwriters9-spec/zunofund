-- Allow the fiat payer to cancel while pending_payment or paid (before release/completion).

CREATE OR REPLACE FUNCTION public.investor_cancel_merchant_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  mo public.merchant_orders%ROWTYPE;
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

  -- Investor pays fiat on sell_* orders only.
  IF mo.side NOT IN ('sell_usdt', 'sell_btc') THEN
    RAISE EXCEPTION 'only the party sending fiat may cancel this trade';
  END IF;

  IF mo.status NOT IN ('pending_payment', 'paid') THEN
    RAISE EXCEPTION 'cannot cancel this order';
  END IF;

  UPDATE public.merchant_orders mo2
  SET status = 'cancelled', updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;
END;
$$;

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

  -- Merchant pays fiat on buy_* orders only.
  IF mo.side NOT IN ('buy_usdt', 'buy_btc') THEN
    RAISE EXCEPTION 'only the party sending fiat may cancel this trade';
  END IF;

  IF mo.status NOT IN ('pending_payment', 'paid') THEN
    RAISE EXCEPTION 'cannot cancel this order';
  END IF;

  -- Legacy upfront escrow (defer=false): restore investor funds on cancel before release.
  IF mo.side = 'buy_usdt' AND NOT coalesce(mo.defer_investor_deduction_until_release, false) THEN
    PERFORM public._merchant_restore_sell_escrow(mo);
  END IF;

  UPDATE public.merchant_orders mo2
  SET status = 'cancelled', updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;
END;
$$;
