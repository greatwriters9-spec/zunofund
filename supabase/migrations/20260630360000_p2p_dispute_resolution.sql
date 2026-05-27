-- P2P dispute resolution: parties open disputes after "paid"; admin chats and awards crypto.

ALTER TABLE public.merchant_orders
  DROP CONSTRAINT IF EXISTS merchant_orders_status_check;

ALTER TABLE public.merchant_orders
  ADD CONSTRAINT merchant_orders_status_check
  CHECK (status IN ('pending_payment', 'paid', 'disputed', 'completed', 'cancelled', 'completed_expired'));

ALTER TABLE public.merchant_orders
  ADD COLUMN IF NOT EXISTS dispute_reason text,
  ADD COLUMN IF NOT EXISTS dispute_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_opened_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_winner text,
  ADD COLUMN IF NOT EXISTS dispute_resolved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.merchant_orders
  DROP CONSTRAINT IF EXISTS merchant_orders_dispute_winner_chk;

ALTER TABLE public.merchant_orders
  ADD CONSTRAINT merchant_orders_dispute_winner_chk CHECK (
    dispute_winner IS NULL OR dispute_winner IN ('investor', 'merchant')
  );

CREATE INDEX IF NOT EXISTS merchant_orders_disputed_idx
  ON public.merchant_orders (dispute_opened_at DESC)
  WHERE status = 'disputed';

ALTER TABLE public.merchant_order_messages
  ADD COLUMN IF NOT EXISTS sender_role text NOT NULL DEFAULT 'party';

ALTER TABLE public.merchant_order_messages
  DROP CONSTRAINT IF EXISTS merchant_order_messages_sender_role_chk;

ALTER TABLE public.merchant_order_messages
  ADD CONSTRAINT merchant_order_messages_sender_role_chk CHECK (
    sender_role IN ('party', 'admin', 'system')
  );

CREATE OR REPLACE FUNCTION public.merchant_order_messages_before_insert_set_sender()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.sender_user_id := auth.uid();
  IF NEW.sender_user_id IS NULL THEN
    RAISE EXCEPTION 'merchant_order_messages requires authentication';
  END IF;

  IF coalesce(trim(NEW.sender_role), '') = 'system' THEN
    RETURN NEW;
  END IF;

  IF public.is_admin(NEW.sender_user_id)
     AND NOT EXISTS (
       SELECT 1
       FROM public.merchant_orders mo
       WHERE mo.id = NEW.order_id
         AND (
           mo.investor_user_id = NEW.sender_user_id
           OR mo.merchant_user_id = NEW.sender_user_id
         )
     ) THEN
    NEW.sender_role := 'admin';
  ELSE
    NEW.sender_role := coalesce(nullif(trim(NEW.sender_role), ''), 'party');
    IF NEW.sender_role NOT IN ('party', 'admin') THEN
      NEW.sender_role := 'party';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

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
          AND mo.status IN ('pending_payment', 'paid', 'disputed')
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
      AND mo.status IN ('pending_payment', 'paid', 'disputed')
  )
);

-- ---------------------------------------------------------------------------
-- Internal: award escrow/crypto per dispute outcome (no party auth checks)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._p2p_dispute_release_crypto_to_investor(p_mo public.merchant_orders)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  bump numeric;
  inv_email text;
  dep_id uuid;
  until_ts timestamptz;
BEGIN
  IF p_mo.side IN ('sell_usdt', 'sell_btc') THEN
    bump := public._p2p_order_usdt_credit(p_mo);
    IF p_mo.side = 'sell_btc' THEN
      bump := coalesce(p_mo.btc_credit_amount, 0);
    END IF;
    IF bump <= 0 THEN
      RAISE EXCEPTION 'invalid credit amount';
    END IF;

    IF p_mo.side = 'sell_btc' THEN
      PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);
      UPDATE public.investors inv
      SET
        btc_balance = coalesce(inv.btc_balance, 0)::numeric + bump,
        btc_withdrawable = coalesce(inv.btc_withdrawable, 0)::numeric + bump
      WHERE inv.user_id = p_mo.investor_user_id;
      RETURN;
    END IF;

    SELECT lower(trim(coalesce(email, ''))) INTO inv_email
    FROM public.investors
    WHERE user_id = p_mo.investor_user_id;

    IF coalesce(inv_email, '') = '' THEN
      RAISE EXCEPTION 'investor email missing';
    END IF;

    INSERT INTO public.deposits (
      user_id, investor_email, amount, txid, payment_method, status, skip_plan_amount_validation
    )
    VALUES (
      p_mo.investor_user_id, inv_email, bump, 'p2p-dispute:' || p_mo.id::text, 'P2P_MERCHANT', 'pending', true
    )
    RETURNING id INTO dep_id;

    UPDATE public.deposits dep SET status = 'approved' WHERE dep.id = dep_id;
    UPDATE public.investors inv
    SET
      balance = coalesce(inv.balance, 0)::numeric + bump,
      locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + bump
    WHERE inv.user_id = p_mo.investor_user_id;

    until_ts := (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 days';
    INSERT INTO public.principal_locks (deposit_id, user_id, investor_email, principal_amount, locked_until)
    VALUES (dep_id, p_mo.investor_user_id, inv_email, bump, until_ts);

    PERFORM public.sync_investment_plan_from_principal(p_mo.investor_user_id);

    UPDATE public.merchant_orders mo3
    SET deposit_id = dep_id
    WHERE mo3.id = p_mo.id;

    RETURN;
  END IF;

  IF p_mo.side IN ('buy_usdt', 'buy_btc') THEN
    PERFORM public._merchant_restore_sell_escrow(p_mo);
    RETURN;
  END IF;

  RAISE EXCEPTION 'unsupported order side';
END;
$$;

REVOKE ALL ON FUNCTION public._p2p_dispute_release_crypto_to_investor(public.merchant_orders) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._p2p_dispute_release_crypto_to_merchant(p_mo public.merchant_orders)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  mo public.merchant_orders%ROWTYPE := p_mo;
  bump numeric;
  n integer;
  inv_email text;
  wid uuid;
BEGIN
  IF mo.side IN ('buy_usdt', 'buy_btc') THEN
    IF mo.side = 'buy_btc' THEN
      bump := coalesce(mo.btc_escrow_amount, 0);
      IF bump <= 0 THEN
        RAISE EXCEPTION 'invalid escrow amount';
      END IF;

      IF NOT coalesce(mo.investor_crypto_deducted_at_lock, false) THEN
        PERFORM public.apply_crypto_withdrawal_deduction(mo.investor_user_id, bump, 'BTC');
      END IF;

      PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);
      UPDATE public.investors inv
      SET
        btc_balance = coalesce(inv.btc_balance, 0)::numeric + bump,
        btc_withdrawable = coalesce(inv.btc_withdrawable, 0)::numeric + bump
      WHERE inv.user_id = mo.merchant_user_id;

      GET DIAGNOSTICS n = ROW_COUNT;
      IF n = 0 THEN
        RAISE EXCEPTION 'merchant investor profile not found';
      END IF;
      RETURN;
    END IF;

    bump := public._p2p_order_usdt_escrow(mo);
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
      user_id, investor_email, amount, wallet_address, payment_method, status,
      merchant_order_id, ledger_deducted
    )
    VALUES (
      mo.investor_user_id, inv_email, bump, 'P2P — dispute settled to merchant', 'p2p', 'pending',
      mo.id, coalesce(mo.investor_crypto_deducted_at_lock, false)
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
    IF n = 0 THEN
      RAISE EXCEPTION 'merchant investor profile not found';
    END IF;

    PERFORM public.sync_investment_plan_from_principal(mo.merchant_user_id);
    RETURN;
  END IF;

  -- sell_* : merchant wins — no crypto credit to investor (fiat handled off-platform).
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public._p2p_dispute_release_crypto_to_merchant(public.merchant_orders) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.open_merchant_order_dispute(
  p_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  mo public.merchant_orders%ROWTYPE;
  reason_trim text;
  order_short text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  reason_trim := left(trim(coalesce(p_reason, '')), 500);
  IF length(reason_trim) < 3 THEN
    RAISE EXCEPTION 'dispute reason required (min 3 characters)';
  END IF;

  SELECT * INTO mo FROM public.merchant_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF mo.investor_user_id <> auth.uid() AND mo.merchant_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'not a party on this trade';
  END IF;

  IF mo.status <> 'paid' THEN
    RAISE EXCEPTION 'disputes can only be opened after payment is marked';
  END IF;

  UPDATE public.merchant_orders mo2
  SET
    status = 'disputed',
    dispute_reason = reason_trim,
    dispute_opened_at = (NOW() AT TIME ZONE 'UTC'),
    dispute_opened_by = auth.uid(),
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;

  order_short := left(mo.id::text, 8);

  PERFORM public.tp_emit_admin_notification(
    'P2P dispute opened',
    format('Trade #%s is disputed. Reason: %s', order_short, reason_trim),
    'p2p_dispute'
  );

  INSERT INTO public.notifications (user_id, investor_email, title, message, type, is_read)
  SELECT
    mo.investor_user_id,
    coalesce(i.email, ''),
    'Dispute opened',
    'An admin will review this trade. Continue chatting in the order thread.',
    'p2p_dispute',
    false
  FROM public.investors i
  WHERE i.user_id = mo.investor_user_id
    AND mo.investor_user_id <> auth.uid();

  INSERT INTO public.notifications (user_id, investor_email, title, message, type, is_read)
  SELECT
    mo.merchant_user_id,
    coalesce(i.email, ''),
    'Dispute opened',
    'An admin will review this trade. Continue chatting in the order thread.',
    'p2p_dispute',
    false
  FROM public.investors i
  WHERE i.user_id = mo.merchant_user_id
    AND mo.merchant_user_id <> auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.open_merchant_order_dispute(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_merchant_order_dispute(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_merchant_order_dispute(
  p_order_id uuid,
  p_winner text,
  p_admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  mo public.merchant_orders%ROWTYPE;
  winner text;
  final_status text;
  note_trim text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  winner := lower(trim(coalesce(p_winner, '')));
  IF winner NOT IN ('investor', 'merchant') THEN
    RAISE EXCEPTION 'winner must be investor or merchant';
  END IF;

  note_trim := left(trim(coalesce(p_admin_note, '')), 500);

  SELECT * INTO mo FROM public.merchant_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF mo.status <> 'disputed' THEN
    RAISE EXCEPTION 'order is not in dispute';
  END IF;

  IF winner = 'investor' THEN
    PERFORM public._p2p_dispute_release_crypto_to_investor(mo);
    final_status := CASE
      WHEN mo.side IN ('sell_usdt', 'sell_btc') THEN 'completed'
      ELSE 'cancelled'
    END;
  ELSE
    PERFORM public._p2p_dispute_release_crypto_to_merchant(mo);
    final_status := CASE
      WHEN mo.side IN ('buy_usdt', 'buy_btc') THEN 'completed'
      ELSE 'cancelled'
    END;
  END IF;

  UPDATE public.merchant_orders mo2
  SET
    status = final_status,
    dispute_winner = winner,
    dispute_resolved_at = (NOW() AT TIME ZONE 'UTC'),
    dispute_resolved_by = auth.uid(),
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;

  INSERT INTO public.merchant_order_messages (
    order_id, sender_user_id, body, sender_role
  )
  VALUES (
    mo.id,
    auth.uid(),
    format(
      'Admin resolved dispute in favor of %s.%s',
      winner,
      CASE WHEN note_trim <> '' THEN E'\n' || note_trim ELSE '' END
    ),
    'system'
  );

  INSERT INTO public.notifications (user_id, investor_email, title, message, type, is_read)
  SELECT
    mo.investor_user_id,
    coalesce(i.email, ''),
    'Dispute resolved',
    format('Admin ruled in favor of the %s.', winner),
    'p2p_dispute',
    false
  FROM public.investors i
  WHERE i.user_id = mo.investor_user_id;

  INSERT INTO public.notifications (user_id, investor_email, title, message, type, is_read)
  SELECT
    mo.merchant_user_id,
    coalesce(i.email, ''),
    'Dispute resolved',
    format('Admin ruled in favor of the %s.', winner),
    'p2p_dispute',
    false
  FROM public.investors i
  WHERE i.user_id = mo.merchant_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_merchant_order_dispute(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_merchant_order_dispute(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_p2p_disputes()
RETURNS TABLE (
  order_id uuid,
  side text,
  status text,
  amount_requested numeric,
  fiat_currency_code text,
  fiat_amount numeric,
  dispute_reason text,
  dispute_opened_at timestamptz,
  investor_user_id uuid,
  merchant_user_id uuid,
  investor_label text,
  merchant_label text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
  SELECT
    mo.id,
    mo.side,
    mo.status,
    mo.amount_requested,
    mo.fiat_currency_code,
    mo.fiat_amount,
    mo.dispute_reason,
    mo.dispute_opened_at,
    mo.investor_user_id,
    mo.merchant_user_id,
    coalesce(nullif(trim(inv.full_name), ''), nullif(trim(inv.email), ''), 'Investor'),
    coalesce(nullif(trim(mp.display_name), ''), 'Merchant')
  FROM public.merchant_orders mo
  LEFT JOIN public.investors inv ON inv.user_id = mo.investor_user_id
  LEFT JOIN public.merchant_profiles mp ON mp.user_id = mo.merchant_user_id
  WHERE mo.status = 'disputed'
    AND public.is_admin(auth.uid())
  ORDER BY mo.dispute_opened_at DESC NULLS LAST, mo.updated_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_p2p_disputes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_p2p_disputes() TO authenticated;
