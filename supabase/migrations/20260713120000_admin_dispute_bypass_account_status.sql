-- Allow admins to resolve P2P disputes regardless of party account status
-- (on_hold / suspended / banned). Restores P2P withdrawal validation and
-- skips account-status guards for trusted admin system actions.

CREATE OR REPLACE FUNCTION public.investor_require_account_action_for_user(
  p_user_id uuid,
  p_action text
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  st text;
  act text := lower(trim(coalesce(p_action, '')));
BEGIN
  IF current_setting('app.tp_admin_system_action', true) = '1' THEN
    RETURN;
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  st := public.investor_account_status_for_user(p_user_id);

  IF st IS NULL THEN
    RAISE EXCEPTION 'investor profile not found';
  END IF;

  IF st = 'active' THEN
    RETURN;
  END IF;

  IF st = 'on_hold' THEN
    IF act IN ('deposit', 'withdraw', 'invest', 'p2p', 'transfer', 'order') THEN
      RAISE EXCEPTION 'account on hold: % is not permitted', act
        USING ERRCODE = 'P0001';
    END IF;
    RETURN;
  END IF;

  IF act IN ('deposit', 'withdraw', 'invest', 'p2p', 'transfer', 'order', 'profit_accrue') THEN
    RAISE EXCEPTION 'account %: % is not permitted', st, act
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.deposits_before_insert_validate_plan_range()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt integer;
  min_usd numeric;
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'deposit requires user_id';
  END IF;

  IF current_setting('app.tp_admin_system_action', true) <> '1'
     AND coalesce(NEW.txid, '') NOT LIKE 'p2p-dispute:%' THEN
    PERFORM public.investor_require_account_action_for_user(NEW.user_id, 'deposit');
  END IF;

  IF NEW.amount IS NULL OR NEW.amount::numeric <= 0 THEN
    RAISE EXCEPTION 'deposit amount must be positive';
  END IF;

  SELECT count(*) INTO cnt
  FROM public.investors AS i
  WHERE i.user_id = NEW.user_id;

  IF cnt = 0 THEN
    RAISE EXCEPTION 'investor profile not found for deposit';
  END IF;

  IF coalesce(NEW.skip_plan_amount_validation, false) THEN
    RETURN NEW;
  END IF;

  min_usd := public.platform_min_deposit_usd();

  IF NEW.amount::numeric < min_usd THEN
    RAISE EXCEPTION
      'deposit amount must be at least % USD', min_usd
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

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
  usdt_amt numeric;
  take_from_profit numeric;
  take_from_principal numeric;
  remain numeric;
BEGIN
  IF NEW.amount IS NULL OR NEW.amount::numeric <= 0 THEN
    RAISE EXCEPTION 'invalid withdrawal amount';
  END IF;

  -- Admin dispute settlement (auth.uid() is admin; escrow belongs to investor).
  IF current_setting('app.tp_admin_system_action', true) = '1'
     AND NEW.merchant_order_id IS NOT NULL
     AND current_setting('app.zuno_p2p_withdrawal_pending_insert', true) = '1' THEN
    IF NEW.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'p2p withdrawal rows must start as pending';
    END IF;
    IF NEW.user_id IS NULL THEN
      RAISE EXCEPTION 'p2p dispute withdrawal requires user_id';
    END IF;

    SELECT * INTO mo_row FROM public.merchant_orders WHERE id = NEW.merchant_order_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'merchant order not found';
    END IF;
    IF mo_row.investor_user_id IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'p2p dispute withdrawal user mismatch';
    END IF;
    IF mo_row.side NOT IN ('buy_usdt', 'buy_btc') OR mo_row.status <> 'disputed' THEN
      RAISE EXCEPTION 'invalid p2p order state for dispute withdrawal';
    END IF;

    usdt_amt := public._p2p_order_usdt_escrow(mo_row);
    IF NEW.amount::numeric IS DISTINCT FROM usdt_amt THEN
      RAISE EXCEPTION 'p2p withdrawal amount must match escrow';
    END IF;

    SELECT * INTO inv_row FROM public.investors WHERE user_id = NEW.user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'investor profile not found';
    END IF;
    IF lower(trim(coalesce(NEW.investor_email, ''))) IS DISTINCT FROM lower(trim(coalesce(inv_row.email, ''))) THEN
      RAISE EXCEPTION 'email mismatch for withdrawal';
    END IF;

    RETURN NEW;
  END IF;

  IF uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NEW.merchant_order_id IS NOT NULL THEN
    IF current_setting('app.zuno_p2p_withdrawal_pending_insert', true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'p2p withdrawals must be created from the investor release flow';
    END IF;
    IF NEW.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'p2p withdrawal rows must start as pending';
    END IF;

    SELECT * INTO mo_row FROM public.merchant_orders WHERE id = NEW.merchant_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'merchant order not found'; END IF;
    IF mo_row.investor_user_id <> uid THEN RAISE EXCEPTION 'not your p2p order'; END IF;
    IF mo_row.side NOT IN ('buy_usdt', 'buy_btc') OR mo_row.status <> 'paid' THEN
      RAISE EXCEPTION 'invalid p2p order state for withdrawal';
    END IF;

    usdt_amt := public._p2p_order_usdt_escrow(mo_row);
    IF NEW.amount::numeric IS DISTINCT FROM usdt_amt THEN
      RAISE EXCEPTION 'p2p withdrawal amount must match escrow';
    END IF;

    SELECT * INTO inv_row FROM public.investors WHERE user_id = uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'investor profile not found'; END IF;
    IF lower(trim(coalesce(NEW.investor_email, ''))) IS DISTINCT FROM lower(trim(coalesce(inv_row.email, ''))) THEN
      RAISE EXCEPTION 'email mismatch for withdrawal';
    END IF;
    NEW.user_id := uid;
    RETURN NEW;
  END IF;

  PERFORM public.investor_require_account_action_for_user(uid, 'withdraw');

  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'new withdrawals must start as pending';
  END IF;

  NEW.user_id := uid;
  usdt_amt := public._withdrawal_input_to_usdt(NEW.amount::numeric, NEW.payment_method);

  SELECT * INTO inv_row FROM public.investors WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'investor profile not found'; END IF;
  IF lower(trim(coalesce(NEW.investor_email, ''))) IS DISTINCT FROM lower(trim(coalesce(inv_row.email, ''))) THEN
    RAISE EXCEPTION 'email mismatch for withdrawal';
  END IF;

  SELECT COALESCE(sum(w.amount::numeric), 0)
  INTO pending_sum
  FROM public.withdrawals AS w
  WHERE w.user_id = uid AND w.status = 'pending';

  avail := COALESCE(inv_row.withdrawable_balance, 0)::numeric;

  IF usdt_amt + pending_sum > avail THEN
    RAISE EXCEPTION
      USING errcode = 'check_violation',
        message = 'withdrawal exceeds available withdrawable funds',
        hint = format('usdt_available=%s, pending_total=%s', avail, pending_sum);
  END IF;

  take_from_profit := LEAST(usdt_amt, coalesce(inv_row.withdrawable_profit, 0));
  remain := usdt_amt - take_from_profit;
  take_from_principal := LEAST(remain, coalesce(inv_row.withdrawable_principal, 0));

  IF take_from_profit + take_from_principal < usdt_amt THEN
    RAISE EXCEPTION 'insufficient withdrawable funds';
  END IF;

  PERFORM public.apply_crypto_withdrawal_deduction(uid, usdt_amt, 'USDT');
  NEW.amount := usdt_amt;
  NEW.ledger_deducted := true;
  NEW.deducted_from_profit := take_from_profit;
  NEW.deducted_from_principal := take_from_principal;

  RETURN NEW;
END;
$$;

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
  reopened_completed boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  PERFORM set_config('app.tp_admin_system_action', '1', true);

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

  reopened_completed := coalesce(mo.dispute_reopened_at IS NOT NULL, false)
    AND coalesce(mo.dispute_hold_applied, false);

  IF reopened_completed THEN
    IF winner = 'investor' THEN
      IF mo.side IN ('sell_usdt', 'sell_btc') THEN
        PERFORM public._p2p_release_dispute_balance_hold(mo, 'resolved');
        final_status := 'completed';
      ELSIF mo.side IN ('buy_usdt', 'buy_btc') THEN
        PERFORM public._p2p_clawback_completed_buy_to_investor(mo);
        PERFORM public._p2p_release_dispute_balance_hold(mo, 'resolved');
        final_status := 'cancelled';
      ELSE
        RAISE EXCEPTION 'unsupported order side';
      END IF;
    ELSE
      IF mo.side IN ('sell_usdt', 'sell_btc') THEN
        PERFORM public._p2p_clawback_completed_sell_credit(mo);
        final_status := 'cancelled';
      ELSIF mo.side IN ('buy_usdt', 'buy_btc') THEN
        PERFORM public._p2p_release_dispute_balance_hold(mo, 'resolved');
        final_status := 'completed';
      ELSE
        RAISE EXCEPTION 'unsupported order side';
      END IF;
    END IF;
  ELSE
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
  END IF;

  UPDATE public.merchant_orders AS mo2
  SET
    status = final_status,
    dispute_winner = winner,
    dispute_resolved_at = (NOW() AT TIME ZONE 'UTC'),
    dispute_resolved_by = auth.uid(),
    dispute_hold_applied = false,
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

  PERFORM set_config('app.tp_admin_system_action', '0', true);
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('app.tp_admin_system_action', '0', true);
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_merchant_order_dispute(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_merchant_order_dispute(uuid, text, text) TO authenticated;
