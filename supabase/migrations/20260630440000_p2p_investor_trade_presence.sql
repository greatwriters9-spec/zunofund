-- Investor P2P trade-page presence (automatic): online while trade tab is open, offline + last seen otherwise.

CREATE OR REPLACE FUNCTION public._investor_is_effectively_online(
  p_is_online boolean,
  p_last_seen_at timestamptz
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(p_is_online, false)
    AND p_last_seen_at IS NOT NULL
    AND p_last_seen_at >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '5 minutes';
$$;

REVOKE ALL ON FUNCTION public._investor_is_effectively_online(boolean, timestamptz) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.investor_set_presence(p_online boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF coalesce(p_online, false) THEN
    UPDATE public.investors AS i
    SET
      is_online = true,
      last_seen_at = (NOW() AT TIME ZONE 'UTC')
    WHERE i.user_id = auth.uid();
  ELSE
    UPDATE public.investors AS i
    SET is_online = false
    WHERE i.user_id = auth.uid();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.merchant_get_order_investor_presence(p_order_id uuid)
RETURNS TABLE (
  is_online boolean,
  last_seen_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
  SELECT
    i.is_online,
    i.last_seen_at
  FROM public.merchant_orders AS mo
  INNER JOIN public.investors AS i ON i.user_id = mo.investor_user_id
  WHERE mo.id = p_order_id
    AND mo.merchant_user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.merchant_get_order_investor_presence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_get_order_investor_presence(uuid) TO authenticated;

-- Align P2P message email skip with trade-page presence window.
CREATE OR REPLACE FUNCTION public.tp_notify_p2p_investor_message_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  order_row public.merchant_orders%ROWTYPE;
  investor_email text := '';
  merchant_label text := 'Merchant';
  trade_ref text := '';
  online_now boolean := false;
  notification_type text := 'p2p_message';
  message_action text := 'sent you a new message';
BEGIN
  SELECT *
  INTO order_row
  FROM public.merchant_orders AS mo
  WHERE mo.id = NEW.order_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_user_id IS DISTINCT FROM order_row.merchant_user_id THEN
    RETURN NEW;
  END IF;

  IF order_row.investor_user_id IS NULL
     OR order_row.investor_user_id IS NOT DISTINCT FROM NEW.sender_user_id THEN
    RETURN NEW;
  END IF;

  SELECT lower(trim(coalesce(i.email, ''))),
         public._investor_is_effectively_online(i.is_online, i.last_seen_at)
  INTO investor_email, online_now
  FROM public.investors AS i
  WHERE i.user_id = order_row.investor_user_id
  LIMIT 1;

  IF coalesce(investor_email, '') = '' THEN
    SELECT lower(trim(coalesce(u.email, '')))
    INTO investor_email
    FROM auth.users AS u
    WHERE u.id = order_row.investor_user_id
    LIMIT 1;
  END IF;

  SELECT coalesce(
    nullif(trim(mp.display_name), ''),
    nullif(trim(i.full_name), ''),
    'Merchant'
  )
  INTO merchant_label
  FROM public.merchant_profiles AS mp
  LEFT JOIN public.investors AS i ON i.user_id = mp.user_id
  WHERE mp.user_id = order_row.merchant_user_id
  LIMIT 1;

  IF nullif(trim(coalesce(NEW.attachment_path, '')), '') IS NOT NULL THEN
    message_action := 'sent you a payment screenshot';
  END IF;

  IF online_now THEN
    notification_type := 'p2p_message_online';
  END IF;

  trade_ref := left(order_row.id::text, 8);

  PERFORM public.tp_emit_investor_notification(
    order_row.investor_user_id,
    investor_email,
    'New P2P message',
    format('%s %s in trade #%s. Open the P2P workspace to reply.', merchant_label, message_action, trade_ref),
    notification_type
  );

  RETURN NEW;
END;
$$;
