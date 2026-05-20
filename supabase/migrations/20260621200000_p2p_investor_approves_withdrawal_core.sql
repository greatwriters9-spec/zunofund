-- P2P sell release: investor "approves" the withdrawal (admin-supervised withdrawals stay admin-only).
-- Flow mirrors admin approve_withdrawal: pending row → apply withdrawal FIFO → status = approved
-- → existing AFTER UPDATE tp_notify_withdrawal_approved sends the same withdrawal_approved notification.

CREATE OR REPLACE FUNCTION public.approve_withdrawal_core(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  w public.withdrawals%ROWTYPE;
  mo public.merchant_orders%ROWTYPE;
  amt numeric := 0;
BEGIN
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
  IF amt <= 0 THEN
    RAISE EXCEPTION 'invalid withdrawal amount';
  END IF;

  -- Wallet / exchange withdrawals: always apply FIFO (same as approve_withdrawal).
  IF w.merchant_order_id IS NULL THEN
    PERFORM public.apply_withdrawal_fifo_deduction(w.user_id, amt);
  ELSE
    -- P2P: apply same FIFO ledger only when escrow was deferred until release.
    SELECT * INTO mo FROM public.merchant_orders WHERE id = w.merchant_order_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'p2p withdrawal references missing merchant order';
    END IF;
    IF coalesce(mo.defer_investor_deduction_until_release, false) THEN
      PERFORM public.apply_withdrawal_fifo_deduction(w.user_id, amt);
    END IF;
  END IF;

  UPDATE public.withdrawals ww
  SET status = 'approved'
  WHERE ww.id = p_withdrawal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_withdrawal_core(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  PERFORM public.approve_withdrawal_core(p_withdrawal_id);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_withdrawal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid) TO authenticated;

-- P2P pending insert path (release flow only). No wallet headroom checks here —
-- investor_release + merchant order guards are authoritative (guarded via set_config).
CREATE OR REPLACE FUNCTION public.withdrawals_before_insert_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  uid uuid := auth.uid();
  inv_row public.investors%ROWTYPE;
  pending_sum numeric := 0;
  avail numeric;
  mo_row public.merchant_orders%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NEW.amount IS NULL OR NEW.amount::numeric <= 0 THEN
    RAISE EXCEPTION 'invalid withdrawal amount';
  END IF;

  -- P2P: pending row created moments before approve_withdrawal_core (investor authorization).
  IF NEW.merchant_order_id IS NOT NULL THEN
    IF current_setting('app.zuno_p2p_withdrawal_pending_insert', true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'p2p withdrawals must be created from the investor release flow';
    END IF;
    IF NEW.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'p2p withdrawal rows must start as pending';
    END IF;

    SELECT *
    INTO mo_row
    FROM public.merchant_orders
    WHERE id = NEW.merchant_order_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'merchant order not found';
    END IF;

    IF mo_row.investor_user_id <> uid THEN
      RAISE EXCEPTION 'not your p2p order';
    END IF;

    IF mo_row.side <> 'buy_usdt' OR mo_row.status <> 'paid' THEN
      RAISE EXCEPTION 'invalid p2p order state for withdrawal';
    END IF;

    IF NEW.amount::numeric IS DISTINCT FROM coalesce(mo_row.usdt_escrow_amount, 0)::numeric THEN
      RAISE EXCEPTION 'p2p withdrawal amount must match escrow';
    END IF;

    SELECT *
    INTO inv_row
    FROM public.investors
    WHERE user_id = uid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'investor profile not found';
    END IF;

    IF lower(trim(coalesce(NEW.investor_email, ''))) IS DISTINCT FROM lower(trim(coalesce(inv_row.email, ''))) THEN
      RAISE EXCEPTION 'email mismatch for withdrawal';
    END IF;

    NEW.user_id := uid;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'new withdrawals must start as pending';
  END IF;

  NEW.user_id := uid;

  SELECT *
  INTO inv_row
  FROM public.investors
  WHERE user_id = uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'investor profile not found';
  END IF;

  IF lower(trim(coalesce(NEW.investor_email, ''))) IS DISTINCT FROM lower(trim(coalesce(inv_row.email, ''))) THEN
    RAISE EXCEPTION 'email mismatch for withdrawal';
  END IF;

  SELECT COALESCE(sum(w.amount::numeric), 0)
  INTO pending_sum
  FROM public.withdrawals AS w
  WHERE w.user_id = uid
    AND w.status = 'pending';

  avail := COALESCE(inv_row.withdrawable_balance, 0)::numeric;

  IF NEW.amount::numeric + pending_sum > avail THEN
    RAISE EXCEPTION
      USING errcode = 'check_violation',
        message = 'withdrawal exceeds available withdrawable funds (principal unlocks after 30 days per deposit; profits accrue separately)',
        hint = format('withdrawable_balance=%s, pending_withdrawals_total=%s', avail, pending_sum);
  END IF;

  RETURN NEW;
END;
$$;

-- Pending P2P row: silence "submitted" + admin pings; UPDATE->approved fires standard withdrawal_approved.
CREATE OR REPLACE FUNCTION public.tp_notify_withdrawal_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  amt text := to_char(coalesce(NEW.amount, 0)::numeric, 'FM999999990.00');
BEGIN
  IF NEW.merchant_order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    NEW.user_id,
    NEW.investor_email,
    'Withdrawal submitted',
    format('We received your withdrawal request for $%s. Our team will review it shortly.', amt),
    'withdrawal_submitted'
  );

  PERFORM public.tp_emit_admin_notification(
    'Pending withdrawal',
    format('%s requested a withdrawal for $%s.', lower(trim(coalesce(NEW.investor_email, ''))), amt),
    'pending_withdrawal'
  );

  RETURN NEW;
END;
$$;

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
    'P2P - settle to merchant (investor-approved)',
    'p2p',
    'pending',
    mo.id
  )
  RETURNING id INTO wid;

  PERFORM public.approve_withdrawal_core(wid);

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
