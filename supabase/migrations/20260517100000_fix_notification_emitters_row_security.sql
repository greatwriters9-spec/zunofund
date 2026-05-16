-- Investor-facing flows (e.g. support ticket INSERT) fire AFTER triggers that call
-- tp_emit_investor_notification / tp_emit_admin_notification.
--
-- Those helpers are SECURITY DEFINER, but RLS on public.notifications and
-- public.admin_notifications still evaluated FOR INSERT using the session JWT
-- (auth.uid()), so non-admin users hit:
--   "new row violates row-level security policy for table ..."
--
-- Scope: row_security=off only inside these two narrow inserter functions.

CREATE OR REPLACE FUNCTION public.tp_emit_investor_notification(
  p_user_id uuid,
  p_email text,
  p_title text,
  p_message text,
  p_type text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
BEGIN
  IF v_email = '' AND p_user_id IS NOT NULL THEN
    SELECT lower(trim(coalesce(inv.email, '')))
    INTO v_email
    FROM public.investors AS inv
    WHERE inv.user_id = p_user_id
    LIMIT 1;
  END IF;

  IF v_email = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    investor_email,
    title,
    message,
    type,
    is_read
  )
  VALUES (
    p_user_id,
    v_email,
    p_title,
    p_message,
    p_type,
    false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tp_emit_admin_notification(
  p_title text,
  p_message text,
  p_type text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  INSERT INTO public.admin_notifications (title, message, type, is_read, email_sent_at)
  VALUES (p_title, p_message, p_type, false, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.tp_emit_investor_notification(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tp_emit_admin_notification(text, text, text) FROM PUBLIC;
