-- Support tickets (and other flows) use direct client INSERTs into support_tickets / deposits / etc.
-- Those tables have AFTER triggers that PERFORM tp_emit_* helpers to fan out rows into
-- public.notifications and public.admin_notifications.
--
-- WHY row_security must be OFF on these emitters:
-- - Trigger functions are SECURITY DEFINER (they run with the definer's privileges),
--   but PostgreSQL still evaluates RLS on the target tables using the **session role**
--   (the investor JWT from PostgREST) unless the function sets row_security off.
-- - admin_notifications INSERT policies are admin-only (is_admin(auth.uid())),
--   so the investor session always fails with:
--     "new row violates row-level security policy for table \"admin_notifications\""
-- - The same pattern applies to investor rows in public.notifications (admin-only INSERT policy).
--
-- WHY DROP + CREATE (not only CREATE OR REPLACE):
-- - Drifted / hand-patched databases sometimes keep a stale pg_proc row; a clean drop/recreate
--   forces security flags and proconfig (search_path, row_security) to match this repo.
--
-- PostgreSQL: session_replication_role / BYPASSRLS are unrelated; the supported fix is
-- SECURITY DEFINER + SET row_security TO off on the narrow writer functions (see SET row_security
-- in https://www.postgresql.org/docs/current/sql-createfunction.html ).
--
-- If a project was never migrated past 20250518120000, apply the full chain; this file alone
-- assumes the functions already exist but may be wrong or stale.

DROP FUNCTION IF EXISTS public.tp_emit_admin_notification(text, text, text);
DROP FUNCTION IF EXISTS public.tp_emit_investor_notification(uuid, text, text, text, text);

CREATE FUNCTION public.tp_emit_investor_notification(
  p_user_id uuid,
  p_email text,
  p_title text,
  p_message text,
  p_type text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
SET row_security TO off
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

CREATE FUNCTION public.tp_emit_admin_notification(
  p_title text,
  p_message text,
  p_type text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
SET row_security TO off
AS $$
BEGIN
  INSERT INTO public.admin_notifications (title, message, type, is_read, email_sent_at)
  VALUES (p_title, p_message, p_type, false, NULL);
END;
$$;

-- Belt-and-suspenders: explicit ALTER ensures prosecdef / proconfig even if a platform quirk
-- skipped CREATE-time attributes on an older Postgres minor.
ALTER FUNCTION public.tp_emit_investor_notification(uuid, text, text, text, text)
  SECURITY DEFINER
  SET search_path TO public
  SET row_security TO off;

ALTER FUNCTION public.tp_emit_admin_notification(text, text, text)
  SECURITY DEFINER
  SET search_path TO public
  SET row_security TO off;

REVOKE ALL ON FUNCTION public.tp_emit_investor_notification(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tp_emit_admin_notification(text, text, text) FROM PUBLIC;

-- Defense in depth: ticket trigger runs in the investor session; keep the whole trigger execution
-- tree from re-applying RLS when calling into writer helpers (same session GUC stack as emitters).
CREATE OR REPLACE FUNCTION public.tp_notify_ticket_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
SET row_security TO off
AS $$
BEGIN
  PERFORM public.tp_emit_investor_notification(
    NULL,
    NEW.investor_email,
    'Support ticket opened',
    format('Ticket "%s" was received. We will reply shortly.', NEW.subject),
    'support_ticket_opened'
  );

  PERFORM public.tp_emit_admin_notification(
    'New support ticket',
    format('%s — %s', lower(trim(coalesce(NEW.investor_email, ''))), NEW.subject),
    'new_ticket'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tp_notify_ticket_inserted() FROM PUBLIC;
