-- Resolve PostgreSQL overload ambiguity: two _p2p_release_dispute_balance_hold
-- signatures caused "function is not unique" when admin_resolve called with one arg.

DROP FUNCTION IF EXISTS public._p2p_release_dispute_balance_hold(public.merchant_orders);

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
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_merchant_order_dispute(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_merchant_order_dispute(uuid, text, text) TO authenticated;
