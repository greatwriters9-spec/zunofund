-- Hotfix: production support-ticket INSERTs were still failing with
--   "new row violates row-level security policy for table \"admin_notifications\""
-- AFTER applying 20260519100000 because the live database still has the legacy
-- trigger `support_ticket_admin_notification` on public.support_tickets, which
-- executes public.notify_admin_new_ticket() — NOT the repo's tp_notify_ticket_inserted.
--
-- The legacy function was created without SECURITY DEFINER / row_security=off, so its
-- INSERT into admin_notifications evaluates RLS using the investor session role and
-- fails the admin-only INSERT policy (with_check: is_admin(auth.uid())).
--
-- This migration only hardens the legacy emitter — same surgical pattern as the
-- tp_emit_* helpers (SECURITY DEFINER + SET search_path=public + SET row_security=off).
-- It does NOT alter behavior beyond closing the RLS gap so investor sessions can fan
-- out a row into admin_notifications via the AFTER trigger. A broader follow-up should
-- decommission notify_admin_new_ticket and adopt tp_notify_ticket_inserted, but that
-- depends on column additions (type/email_sent_at) that the live DB has not received.

CREATE OR REPLACE FUNCTION public.notify_admin_new_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
SET row_security TO off
AS $$
BEGIN
  INSERT INTO public.admin_notifications (title, message)
  VALUES (
    'New Support Ticket',
    NEW.investor_email || ' submitted a support ticket.'
  );

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_admin_new_ticket()
  SECURITY DEFINER
  SET search_path TO public
  SET row_security TO off;

REVOKE ALL ON FUNCTION public.notify_admin_new_ticket() FROM PUBLIC;
