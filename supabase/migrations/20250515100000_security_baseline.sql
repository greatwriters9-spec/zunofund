-- Security baseline for trading-platform Supabase project.
-- Prerequisite: tables ... 
-- Optional column for row-level policies (safe if already present):
ALTER TABLE public.profits
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

-- Email helper for JWT (Supabase exposes email on the access token).
CREATE OR REPLACE FUNCTION public.request_email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT lower(trim(auth.jwt() ->> 'email'));
$$;

-- Admin lookup; SECURITY DEFINER so it remains usable inside triggers / RPCs regardless of admins RLS.
CREATE OR REPLACE FUNCTION public.is_admin(check_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admins AS a
    WHERE a.user_id = check_uid
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.request_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_email() TO authenticated;

-- Prevent investors from crediting themselves by editing balances.
CREATE OR REPLACE FUNCTION public.investors_prevent_financial_self_edit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF tg_op = 'UPDATE' THEN
    IF NOT public.is_admin(auth.uid()) THEN
      NEW.balance := OLD.balance;
      NEW.total_profit := OLD.total_profit;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS investors_lock_financial_cols ON public.investors;

CREATE TRIGGER investors_lock_financial_cols
BEFORE UPDATE ON public.investors
FOR EACH ROW
EXECUTE PROCEDURE public.investors_prevent_financial_self_edit();

-- --- RLS: enable on all API-facing tables ---
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- --- Drop old policies (rename if you customized) ---
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (
        ARRAY[
          'investors',
          'deposits',
          'withdrawals',
          'profits',
          'notifications',
          'admins',
          'support_tickets',
          'ticket_replies',
          'admin_notifications'
        ]
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- investors
CREATE POLICY investors_select_own_or_admin
ON public.investors
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY investors_insert_own
ON public.investors
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY investors_update_own_or_admin
ON public.investors
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- deposits
CREATE POLICY deposits_select_own_or_admin
ON public.deposits
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY deposits_insert_own
ON public.deposits
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND lower(trim(investor_email)) IS NOT DISTINCT FROM public.request_email()
);

-- withdrawals
CREATE POLICY withdrawals_select_own_or_admin
ON public.withdrawals
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR lower(trim(investor_email)) IS NOT DISTINCT FROM public.request_email()
);

CREATE POLICY withdrawals_insert_own
ON public.withdrawals
FOR INSERT
TO authenticated
WITH CHECK (
  lower(trim(investor_email)) IS NOT DISTINCT FROM public.request_email()
);

CREATE POLICY withdrawals_update_admin_only
ON public.withdrawals
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- profits (admin writes; investor reads own)
CREATE POLICY profits_select_own_or_admin
ON public.profits
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR user_id = auth.uid()
  OR lower(trim(investor_email)) IS NOT DISTINCT FROM public.request_email()
);

CREATE POLICY profits_insert_admin
ON public.profits
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY profits_update_admin
ON public.profits
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY profits_delete_admin
ON public.profits
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- notifications
CREATE POLICY notifications_select_own_or_admin
ON public.notifications
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR user_id = auth.uid()
  OR lower(trim(investor_email)) IS NOT DISTINCT FROM public.request_email()
);

CREATE POLICY notifications_insert_admin_only
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY notifications_update_own
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- admins: each user can only read their own admin row (for login checks / proxy).
CREATE POLICY admins_select_self_only
ON public.admins
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- support_tickets
CREATE POLICY tickets_select_own_or_admin
ON public.support_tickets
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR lower(trim(investor_email)) IS NOT DISTINCT FROM public.request_email()
);

CREATE POLICY tickets_insert_own
ON public.support_tickets
FOR INSERT
TO authenticated
WITH CHECK (
  lower(trim(investor_email)) IS NOT DISTINCT FROM public.request_email()
);

CREATE POLICY tickets_update_own_or_admin
ON public.support_tickets
FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR lower(trim(investor_email)) IS NOT DISTINCT FROM public.request_email()
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR lower(trim(investor_email)) IS NOT DISTINCT FROM public.request_email()
);

-- ticket_replies
CREATE POLICY ticket_replies_select_related
ON public.ticket_replies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.support_tickets AS st
    WHERE st.id = ticket_replies.ticket_id
      AND (
        public.is_admin(auth.uid())
        OR lower(trim(st.investor_email)) IS NOT DISTINCT FROM public.request_email()
      )
  )
);

CREATE POLICY ticket_replies_insert_related
ON public.ticket_replies
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.support_tickets AS st
    WHERE st.id = ticket_id
      AND (
        (public.is_admin(auth.uid()) AND sender = 'admin')
        OR (
          lower(trim(st.investor_email)) IS NOT DISTINCT FROM public.request_email()
          AND sender = 'user'
        )
      )
  )
);

-- admin_notifications
CREATE POLICY admin_notifications_admin_all_select
ON public.admin_notifications
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY admin_notifications_admin_all_insert
ON public.admin_notifications
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY admin_notifications_admin_all_update
ON public.admin_notifications
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY admin_notifications_admin_all_delete
ON public.admin_notifications
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));
