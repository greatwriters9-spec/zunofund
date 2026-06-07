-- Allow escrow release while still pending_payment (counterparty need not mark paid first).
-- Allow trade chat (and proof uploads) after a trade is completed.

-- ---------------------------------------------------------------------------
-- 1) merchant_release_buy_order: accept pending_payment or paid
-- ---------------------------------------------------------------------------
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

  PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);

  SELECT * INTO mo FROM public.merchant_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF mo.merchant_user_id <> auth.uid() THEN RAISE EXCEPTION 'not your order'; END IF;
  IF mo.side NOT IN ('sell_usdt', 'sell_btc') OR mo.status NOT IN ('pending_payment', 'paid') THEN
    RAISE EXCEPTION 'invalid order state';
  END IF;

  bump := public._p2p_order_usdt_credit(mo);
  IF bump <= 0 THEN RAISE EXCEPTION 'invalid credit amount'; END IF;

  SELECT lower(trim(coalesce(email, ''))) INTO inv_email FROM public.investors WHERE user_id = mo.investor_user_id;
  IF NOT FOUND OR inv_email IS NULL OR inv_email = '' THEN RAISE EXCEPTION 'investor email missing'; END IF;

  INSERT INTO public.deposits (user_id, investor_email, amount, txid, payment_method, status, skip_plan_amount_validation)
  VALUES (mo.investor_user_id, inv_email, bump, 'p2p:' || mo.id::text, 'P2P_MERCHANT', 'pending', true)
  RETURNING id INTO dep_id;

  UPDATE public.deposits AS dep SET status = 'approved' WHERE dep.id = dep_id;

  until_ts := (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 days';

  UPDATE public.investors AS inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + bump,
    locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + bump
  WHERE inv.user_id = mo.investor_user_id;

  INSERT INTO public.principal_locks (
    deposit_id, user_id, investor_email, principal_amount, locked_until, lock_source
  )
  VALUES (dep_id, mo.investor_user_id, inv_email, bump, until_ts, 'deposit');

  sync_uid := mo.investor_user_id;
  PERFORM public.sync_investment_plan_from_principal(sync_uid);
  PERFORM public.evaluate_investor_rewards_bundle(sync_uid, dep_id);
  PERFORM public.advance_investor_holding_streak(sync_uid);
  PERFORM public.apply_referral_bonus_for_deposit(dep_id);

  UPDATE public.merchant_orders AS mo2
  SET status = 'completed', deposit_id = dep_id, updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_release_buy_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_release_buy_order(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) investor_release_merchant_buy_order: accept pending_payment or paid
-- ---------------------------------------------------------------------------
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
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO mo FROM public.merchant_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF mo.investor_user_id <> auth.uid() THEN RAISE EXCEPTION 'not your order'; END IF;
  IF mo.side NOT IN ('buy_usdt', 'buy_btc') OR mo.status NOT IN ('pending_payment', 'paid') THEN
    RAISE EXCEPTION 'invalid order state';
  END IF;

  bump := public._p2p_order_usdt_escrow(mo);
  IF bump <= 0 THEN RAISE EXCEPTION 'invalid escrow amount'; END IF;

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
    merchant_order_id,
    ledger_deducted
  )
  VALUES (
    mo.investor_user_id,
    inv_email,
    bump,
    'P2P — settled to merchant',
    'p2p',
    'pending',
    mo.id,
    coalesce(mo.investor_crypto_deducted_at_lock, false)
  )
  RETURNING id INTO wid;

  PERFORM public.approve_withdrawal_core(wid);

  PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);

  UPDATE public.investors inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + bump,
    withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric + bump
  WHERE inv.user_id = mo.merchant_user_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'merchant investor profile not found'; END IF;

  PERFORM public.sync_investment_plan_from_principal(mo.merchant_user_id);

  UPDATE public.merchant_orders mo2
  SET status = 'completed', updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_release_merchant_buy_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_release_merchant_buy_order(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Trade chat + proof uploads on completed orders
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS merchant_order_messages_insert_party ON public.merchant_order_messages;

CREATE POLICY merchant_order_messages_insert_party
ON public.merchant_order_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.merchant_orders mo
    WHERE mo.id = merchant_order_messages.order_id
      AND (
        (
          (
            mo.investor_user_id = auth.uid()
            OR mo.merchant_user_id = auth.uid()
          )
          AND mo.status IN ('pending_payment', 'paid', 'disputed', 'completed')
        )
        OR (
          public.is_admin(auth.uid())
          AND mo.status = 'disputed'
        )
      )
  )
);

DROP POLICY IF EXISTS "p2p_payment_proofs_insert_party" ON storage.objects;

CREATE POLICY "p2p_payment_proofs_insert_party"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'p2p-payment-proofs'
  AND split_part(storage.objects.name, '/', 2) = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.merchant_orders mo
    WHERE mo.id::text = split_part(storage.objects.name, '/', 1)
      AND (
        mo.investor_user_id = auth.uid()
        OR mo.merchant_user_id = auth.uid()
        OR (
          public.is_admin(auth.uid())
          AND mo.status = 'disputed'
        )
      )
      AND mo.status IN ('pending_payment', 'paid', 'disputed', 'completed')
  )
);
