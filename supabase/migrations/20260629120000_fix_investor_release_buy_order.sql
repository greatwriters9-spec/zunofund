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

  IF mo.side NOT IN ('buy_usdt', 'buy_btc') OR mo.status <> 'paid' THEN
    RAISE EXCEPTION 'invalid order state';
  END IF;

  IF mo.side = 'buy_btc' THEN
    bump := coalesce(mo.btc_escrow_amount, 0);
    IF bump <= 0 THEN
      RAISE EXCEPTION 'invalid escrow amount';
    END IF;

    PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);

    UPDATE public.investors inv
    SET
      btc_balance = greatest(0::numeric, coalesce(inv.btc_balance, 0)::numeric - bump),
      btc_withdrawable = greatest(0::numeric, coalesce(inv.btc_withdrawable, 0)::numeric - bump)
    WHERE inv.user_id = mo.investor_user_id;

    UPDATE public.investors inv
    SET
      btc_balance = coalesce(inv.btc_balance, 0)::numeric + bump,
      btc_withdrawable = coalesce(inv.btc_withdrawable, 0)::numeric + bump
    WHERE inv.user_id = mo.merchant_user_id;

    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN
      RAISE EXCEPTION 'merchant investor profile not found';
    END IF;

    UPDATE public.merchant_orders mo2
    SET status = 'completed', updated_at = (NOW() AT TIME ZONE 'UTC')
    WHERE mo2.id = mo.id;

    RETURN;
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

  PERFORM set_config('app.zuno_p2p_withdrawal_pending_insert', '1', true);

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
    'pending',
    mo.id
  )
  RETURNING id INTO wid;

  PERFORM public.approve_withdrawal_core(wid);

  UPDATE public.investors inv
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
  SET status = 'completed', updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_release_merchant_buy_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_release_merchant_buy_order(uuid) TO authenticated;
