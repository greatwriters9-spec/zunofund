-- Admin Communication Center: email threads, outbound/inbound mail, admin notes,
-- extended notifications, and additional platform event alerts.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL DEFAULT '',
  customer_email text NOT NULL,
  customer_name text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'archived', 'closed')),
  is_starred boolean NOT NULL DEFAULT false,
  last_message_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  created_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  updated_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS email_threads_customer_email_idx
  ON public.email_threads (lower(customer_email));
CREATE INDEX IF NOT EXISTS email_threads_last_message_idx
  ON public.email_threads (last_message_at DESC);
CREATE INDEX IF NOT EXISTS email_threads_status_idx
  ON public.email_threads (status);

CREATE TABLE IF NOT EXISTS public.emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.email_threads (id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_email text NOT NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body_text text,
  body_html text,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'sent', 'draft', 'scheduled', 'failed')),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  resend_message_id text,
  is_read boolean NOT NULL DEFAULT false,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS emails_thread_id_idx ON public.emails (thread_id, created_at);
CREATE INDEX IF NOT EXISTS emails_status_idx ON public.emails (status);
CREATE INDEX IF NOT EXISTS emails_direction_idx ON public.emails (direction);

CREATE TABLE IF NOT EXISTS public.admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id uuid NOT NULL REFERENCES public.investors (id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS admin_notes_investor_idx
  ON public.admin_notes (investor_id, created_at DESC);

ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS action_link text;

-- ---------------------------------------------------------------------------
-- Extended admin notification emitter (replace 3-arg version)
DROP FUNCTION IF EXISTS public.tp_emit_admin_notification(text, text, text);

CREATE OR REPLACE FUNCTION public.tp_emit_admin_notification(
  p_title text,
  p_message text,
  p_type text,
  p_entity_id uuid DEFAULT NULL,
  p_action_link text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  INSERT INTO public.admin_notifications (
    title, message, type, is_read, email_sent_at, entity_id, action_link
  )
  VALUES (
    p_title, p_message, p_type, false, NULL, p_entity_id, p_action_link
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tp_emit_admin_notification(text, text, text, uuid, text) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Email thread helpers (service / admin RPCs)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_list_email_threads(
  p_folder text DEFAULT 'inbox',
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  subject text,
  customer_email text,
  customer_name text,
  status text,
  is_starred boolean,
  last_message_at timestamptz,
  created_at timestamptz,
  unread_count bigint,
  last_preview text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  folder text := lower(trim(coalesce(p_folder, 'inbox')));
  q text := lower(trim(coalesce(p_search, '')));
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.subject,
    t.customer_email,
    t.customer_name,
    t.status,
    t.is_starred,
    t.last_message_at,
    t.created_at,
    (
      SELECT count(*)::bigint
      FROM public.emails e
      WHERE e.thread_id = t.id
        AND e.direction = 'inbound'
        AND NOT e.is_read
    ) AS unread_count,
    (
      SELECT left(coalesce(e.body_text, ''), 120)
      FROM public.emails e
      WHERE e.thread_id = t.id
      ORDER BY e.created_at DESC
      LIMIT 1
    ) AS last_preview
  FROM public.email_threads t
  WHERE
    CASE folder
      WHEN 'archived' THEN t.status = 'archived'
      WHEN 'inbox' THEN t.status = 'open'
      ELSE t.status IN ('open', 'archived', 'closed')
    END
    AND (
      q = ''
      OR lower(t.subject) LIKE '%' || q || '%'
      OR lower(t.customer_email) LIKE '%' || q || '%'
      OR lower(coalesce(t.customer_name, '')) LIKE '%' || q || '%'
    )
  ORDER BY t.is_starred DESC, t.last_message_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_email_threads(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_email_threads(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_email_thread_messages(p_thread_id uuid)
RETURNS SETOF public.emails
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  SELECT e.*
  FROM public.emails e
  WHERE e.thread_id = p_thread_id
  ORDER BY e.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_email_thread_messages(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_email_thread_messages(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_mark_email_thread_read(p_thread_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  UPDATE public.emails
  SET is_read = true
  WHERE thread_id = p_thread_id AND direction = 'inbound' AND NOT is_read;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_mark_email_thread_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_mark_email_thread_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_email_thread_starred(
  p_thread_id uuid,
  p_starred boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  UPDATE public.email_threads
  SET is_starred = coalesce(p_starred, false), updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE id = p_thread_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_email_thread_starred(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_email_thread_starred(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_archive_email_thread(p_thread_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  UPDATE public.email_threads
  SET status = 'archived', updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE id = p_thread_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_archive_email_thread(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_archive_email_thread(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.service_record_inbound_email(
  p_from_email text,
  p_from_name text,
  p_to_email text,
  p_subject text,
  p_body_text text,
  p_body_html text,
  p_attachments jsonb DEFAULT '[]'::jsonb,
  p_resend_message_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  sender text := lower(trim(coalesce(p_from_email, '')));
  subj text := trim(coalesce(p_subject, '(no subject)'));
  tid uuid;
  eid uuid;
  preview text;
BEGIN
  IF sender = '' THEN
    RAISE EXCEPTION 'sender email required';
  END IF;

  SELECT t.id INTO tid
  FROM public.email_threads t
  WHERE lower(t.customer_email) = sender
    AND t.status = 'open'
    AND lower(trim(t.subject)) = lower(subj)
  ORDER BY t.last_message_at DESC
  LIMIT 1;

  IF tid IS NULL THEN
    INSERT INTO public.email_threads (subject, customer_email, customer_name, status)
    VALUES (subj, sender, nullif(trim(coalesce(p_from_name, '')), ''), 'open')
    RETURNING id INTO tid;
  END IF;

  INSERT INTO public.emails (
    thread_id, direction, sender_email, recipient_email, subject,
    body_text, body_html, status, attachments, resend_message_id, is_read, sent_at
  )
  VALUES (
    tid, 'inbound', sender, lower(trim(coalesce(p_to_email, ''))), subj,
    p_body_text, p_body_html, 'received', coalesce(p_attachments, '[]'::jsonb),
    p_resend_message_id, false, (NOW() AT TIME ZONE 'UTC')
  )
  RETURNING id INTO eid;

  preview := left(coalesce(p_body_text, ''), 200);

  UPDATE public.email_threads
  SET
    subject = CASE WHEN subj <> '' THEN subj ELSE subject END,
    last_message_at = (NOW() AT TIME ZONE 'UTC'),
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE id = tid;

  PERFORM public.tp_emit_admin_notification(
    'New support email',
    format('From: %s - %s', sender, preview),
    'support_email',
    tid,
    '/admin/communication'
  );

  RETURN tid;
END;
$$;

REVOKE ALL ON FUNCTION public.service_record_inbound_email(text, text, text, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_record_inbound_email(text, text, text, text, text, text, jsonb, text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_record_outbound_email(
  p_thread_id uuid,
  p_recipient_email text,
  p_subject text,
  p_body_text text,
  p_body_html text DEFAULT NULL,
  p_status text DEFAULT 'sent',
  p_resend_message_id text DEFAULT NULL,
  p_attachments jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  tid uuid := p_thread_id;
  recipient text := lower(trim(coalesce(p_recipient_email, '')));
  subj text := trim(coalesce(p_subject, ''));
  from_email text;
  eid uuid;
  admin_uid uuid := auth.uid();
BEGIN
  IF admin_uid IS NULL OR NOT public.is_admin(admin_uid) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF recipient = '' THEN
    RAISE EXCEPTION 'recipient required';
  END IF;

  SELECT lower(trim(coalesce(s.support_email, '')))
  INTO from_email
  FROM public.platform_contact_settings s
  WHERE s.id = 'default'
  LIMIT 1;

  IF coalesce(from_email, '') = '' THEN
    from_email := 'support@zunofund.com';
  END IF;

  IF tid IS NULL THEN
    INSERT INTO public.email_threads (subject, customer_email, status)
    VALUES (subj, recipient, 'open')
    RETURNING id INTO tid;
  END IF;

  INSERT INTO public.emails (
    thread_id, direction, sender_email, recipient_email, subject,
    body_text, body_html, status, attachments, resend_message_id,
    is_read, sent_at, created_by
  )
  VALUES (
    tid, 'outbound', from_email, recipient, subj,
    p_body_text, p_body_html, coalesce(nullif(trim(p_status), ''), 'sent'),
    coalesce(p_attachments, '[]'::jsonb), p_resend_message_id,
    true, (NOW() AT TIME ZONE 'UTC'), admin_uid
  )
  RETURNING id INTO eid;

  UPDATE public.email_threads
  SET
    subject = CASE WHEN subj <> '' THEN subj ELSE subject END,
    customer_email = recipient,
    last_message_at = (NOW() AT TIME ZONE 'UTC'),
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE id = tid;

  RETURN eid;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_record_outbound_email(uuid, text, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_record_outbound_email(uuid, text, text, text, text, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_save_email_draft(
  p_thread_id uuid,
  p_recipient_email text,
  p_subject text,
  p_body_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  tid uuid := p_thread_id;
  recipient text := lower(trim(coalesce(p_recipient_email, '')));
  subj text := trim(coalesce(p_subject, ''));
  from_email text := 'support@zunofund.com';
  eid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF recipient = '' THEN
    RAISE EXCEPTION 'recipient required';
  END IF;

  IF tid IS NULL THEN
    INSERT INTO public.email_threads (subject, customer_email, status)
    VALUES (subj, recipient, 'open')
    RETURNING id INTO tid;
  END IF;

  INSERT INTO public.emails (
    thread_id, direction, sender_email, recipient_email, subject,
    body_text, status, is_read, created_by
  )
  VALUES (
    tid, 'outbound', from_email, recipient, subj,
    p_body_text, 'draft', true, auth.uid()
  )
  RETURNING id INTO eid;

  RETURN eid;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_email_draft(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_email_draft(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_email_drafts()
RETURNS SETOF public.emails
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  SELECT e.*
  FROM public.emails e
  WHERE e.status = 'draft'
  ORDER BY e.created_at DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_email_drafts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_email_drafts() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_mark_notifications_read(p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  UPDATE public.admin_notifications
  SET is_read = true
  WHERE id = ANY(p_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_mark_notifications_read(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_mark_notifications_read(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  UPDATE public.admin_notifications SET is_read = true WHERE NOT is_read;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_mark_all_notifications_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_mark_all_notifications_read() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_add_investor_note(
  p_investor_id uuid,
  p_note text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  nid uuid;
  note_trim text := left(trim(coalesce(p_note, '')), 2000);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF note_trim = '' THEN
    RAISE EXCEPTION 'note required';
  END IF;

  INSERT INTO public.admin_notes (investor_id, note, created_by)
  VALUES (p_investor_id, note_trim, auth.uid())
  RETURNING id INTO nid;

  RETURN nid;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_investor_note(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_investor_note(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_investor_communication_history(p_investor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  inv public.investors%ROWTYPE;
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT * INTO inv FROM public.investors WHERE id = p_investor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'investor not found';
  END IF;

  SELECT jsonb_build_object(
    'investor_email', inv.email,
    'email_threads', coalesce((
      SELECT jsonb_agg(sub.row ORDER BY sub.row->>'last_message_at' DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', t.id,
          'subject', t.subject,
          'status', t.status,
          'last_message_at', t.last_message_at
        ) AS row
        FROM public.email_threads t
        WHERE lower(t.customer_email) = lower(trim(inv.email))
        ORDER BY t.last_message_at DESC
        LIMIT 50
      ) sub
    ), '[]'::jsonb),
    'support_tickets', coalesce((
      SELECT jsonb_agg(sub.row ORDER BY sub.row->>'created_at' DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', st.id,
          'subject', st.subject,
          'status', st.status,
          'created_at', st.created_at
        ) AS row
        FROM public.support_tickets st
        WHERE lower(trim(st.investor_email)) = lower(trim(inv.email))
        ORDER BY st.created_at DESC
        LIMIT 50
      ) sub
    ), '[]'::jsonb),
    'notifications', coalesce((
      SELECT jsonb_agg(sub.row ORDER BY sub.row->>'created_at' DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', n.id,
          'title', n.title,
          'type', n.type,
          'created_at', n.created_at
        ) AS row
        FROM public.notifications n
        WHERE lower(trim(n.investor_email)) = lower(trim(inv.email))
        ORDER BY n.created_at DESC
        LIMIT 50
      ) sub
    ), '[]'::jsonb),
    'admin_notes', coalesce((
      SELECT jsonb_agg(sub.row ORDER BY sub.row->>'created_at' DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', an.id,
          'note', an.note,
          'created_at', an.created_at
        ) AS row
        FROM public.admin_notes an
        WHERE an.investor_id = p_investor_id
        ORDER BY an.created_at DESC
        LIMIT 50
      ) sub
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_investor_communication_history(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_investor_communication_history(uuid) TO authenticated;

-- Support email list for admin desk
CREATE OR REPLACE FUNCTION public.service_get_support_inbox_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(trim(s.support_email), ''),
    'support@zunofund.com'
  )
  FROM public.platform_contact_settings s
  WHERE s.id = 'default'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.service_get_support_inbox_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_get_support_inbox_email() TO service_role, authenticated;

-- ---------------------------------------------------------------------------
-- Additional platform event notifications
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tp_notify_investor_registered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  name text;
BEGIN
  name := trim(concat_ws(' ', NEW.first_name, NEW.surname, NEW.full_name));
  PERFORM public.tp_emit_admin_notification(
    'New user registration',
    format(
      'A new user has registered.%sName: %s%sEmail: %s%sDate: %s',
      E'\n',
      coalesce(nullif(name, ''), '-'),
      E'\n',
      coalesce(NEW.email, '-'),
      E'\n',
      to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI UTC')
    ),
    'new_registration',
    NEW.id,
    '/admin/investors'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tp_notify_investor_registered ON public.investors;
CREATE TRIGGER tp_notify_investor_registered
  AFTER INSERT ON public.investors
  FOR EACH ROW
  EXECUTE FUNCTION public.tp_notify_investor_registered();

CREATE OR REPLACE FUNCTION public.tp_notify_account_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  old_st text;
  new_st text;
BEGIN
  old_st := lower(trim(coalesce(OLD.account_status, OLD.status, 'active')));
  new_st := lower(trim(coalesce(NEW.account_status, NEW.status, 'active')));

  IF old_st IS NOT DISTINCT FROM new_st THEN
    RETURN NEW;
  END IF;

  IF new_st IN ('on_hold', 'suspended', 'banned') THEN
    PERFORM public.tp_emit_admin_notification(
      format('Account %s', replace(new_st, '_', ' ')),
      format(
        'Investor %s account status changed to %s.%sReason: %s',
        coalesce(NEW.email, '-'),
        new_st,
        E'\n',
        coalesce(nullif(trim(NEW.status_reason), ''), '-')
      ),
      'account_status_' || new_st,
      NEW.id,
      '/admin/investors'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tp_notify_account_status_changed ON public.investors;
CREATE TRIGGER tp_notify_account_status_changed
  AFTER UPDATE OF account_status, status ON public.investors
  FOR EACH ROW
  EXECUTE FUNCTION public.tp_notify_account_status_changed();

CREATE OR REPLACE FUNCTION public.tp_notify_merchant_order_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    PERFORM public.tp_emit_admin_notification(
      'P2P order completed',
      format(
        'Trade %s completed.%sSide: %s%sAmount: %s USDT',
        left(NEW.id::text, 8),
        E'\n',
        NEW.side,
        E'\n',
        coalesce(NEW.usdt_escrow_amount, NEW.amount_requested, 0)::text
      ),
      'p2p_completed',
      NEW.id,
      '/admin/p2p-disputes'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tp_notify_merchant_order_completed ON public.merchant_orders;
CREATE TRIGGER tp_notify_merchant_order_completed
  AFTER UPDATE OF status ON public.merchant_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.tp_notify_merchant_order_completed();

CREATE OR REPLACE FUNCTION public.tp_notify_large_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  threshold numeric := 5000;
  amt numeric;
BEGIN
  amt := coalesce(NEW.amount::numeric, 0);
  IF amt < threshold THEN
    RETURN NEW;
  END IF;

  PERFORM public.tp_emit_admin_notification(
    'Large transaction detected',
    format(
      'Large %s of $%s from %s on %s',
      TG_TABLE_NAME,
      trim(to_char(amt, 'FM999999990.00')),
      coalesce(NEW.investor_email, '-'),
      to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI UTC')
    ),
    'large_transaction',
    NEW.id,
    CASE TG_TABLE_NAME
      WHEN 'deposits' THEN '/admin/deposits'
      ELSE '/admin/withdrawals'
    END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tp_notify_large_deposit ON public.deposits;
CREATE TRIGGER tp_notify_large_deposit
  AFTER INSERT ON public.deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.tp_notify_large_transaction();

DROP TRIGGER IF EXISTS tp_notify_large_withdrawal ON public.withdrawals;
CREATE TRIGGER tp_notify_large_withdrawal
  AFTER INSERT ON public.withdrawals
  FOR EACH ROW
  WHEN (NEW.merchant_order_id IS NULL)
  EXECUTE FUNCTION public.tp_notify_large_transaction();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_threads_admin_all ON public.email_threads;
CREATE POLICY email_threads_admin_all ON public.email_threads
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS emails_admin_all ON public.emails;
CREATE POLICY emails_admin_all ON public.emails
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS admin_notes_admin_all ON public.admin_notes;
CREATE POLICY admin_notes_admin_all ON public.admin_notes
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

REVOKE ALL ON public.email_threads FROM PUBLIC;
REVOKE ALL ON public.emails FROM PUBLIC;
REVOKE ALL ON public.admin_notes FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emails TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notes TO authenticated;

-- Realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.email_threads';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.emails';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
