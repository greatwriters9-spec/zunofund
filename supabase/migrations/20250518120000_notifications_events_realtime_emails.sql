-- Investor + admin notifications for deposit / withdraw / ticket / profit / unlock / compound flows,
-- realtime publication, webhook-driven outbound email companion (Next `/api/webhooks/notify-email`).
--
-- Wire email: Supabase Dashboard → Database Webhooks → POST `https://<your-host>/api/webhooks/notify-email`
-- Headers: `x-webhook-secret: <NOTIFICATION_WEBHOOK_SECRET>`
-- Hooks: INSERT on `public.notifications` and INSERT on `public.admin_notifications`.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'general';

ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

-- Supabase Broadcast Realtime (idempotent)
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;

-- Service role only: list admin emails for outbound mailers (used by Next webhook).
CREATE OR REPLACE FUNCTION public.service_list_admin_emails()
RETURNS TABLE (email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.email::text
  FROM auth.users AS u
  INNER JOIN public.admins AS a ON a.user_id = u.id
  WHERE u.email IS NOT NULL
    AND length(trim(u.email)) > 0;
$$;

REVOKE ALL ON FUNCTION public.service_list_admin_emails() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_list_admin_emails() TO service_role;

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

REVOKE ALL ON FUNCTION public.tp_emit_investor_notification(uuid, text, text, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.tp_emit_admin_notification(
  p_title text,
  p_message text,
  p_type text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_notifications (title, message, type, is_read, email_sent_at)
  VALUES (p_title, p_message, p_type, false, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.tp_emit_admin_notification(text, text, text) FROM PUBLIC;

-- --- Deposits: pending submitted ---
CREATE OR REPLACE FUNCTION public.tp_notify_deposit_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt text := to_char(coalesce(NEW.amount, 0)::numeric, 'FM999999990.00');
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    NEW.user_id,
    NEW.investor_email,
    'Deposit request received',
    format('We received your deposit request for $%s. Funds will show in your vault after approval.', amt),
    'deposit_submitted'
  );

  PERFORM public.tp_emit_admin_notification(
    'Pending deposit',
    format('%s requested a deposit for $%s.', lower(trim(coalesce(NEW.investor_email, ''))), amt),
    'pending_deposit'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tp_notify_deposit_inserted() FROM PUBLIC;
DROP TRIGGER IF EXISTS tp_notify_deposit_insert ON public.deposits;
CREATE TRIGGER tp_notify_deposit_insert
AFTER INSERT ON public.deposits
FOR EACH ROW
EXECUTE PROCEDURE public.tp_notify_deposit_inserted();

-- --- Deposits: approved ---
CREATE OR REPLACE FUNCTION public.tp_notify_deposit_approved_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt text := to_char(coalesce(NEW.amount, 0)::numeric, 'FM999999990.00');
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    NEW.user_id,
    NEW.investor_email,
    'Deposit approved',
    format('Your deposit of $%s was approved and is now securing your tier lock (30‑day maturity).', amt),
    'deposit_approved'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tp_notify_deposit_approved_row() FROM PUBLIC;
DROP TRIGGER IF EXISTS tp_notify_deposit_approved ON public.deposits;
CREATE TRIGGER tp_notify_deposit_approved
AFTER UPDATE ON public.deposits
FOR EACH ROW
EXECUTE PROCEDURE public.tp_notify_deposit_approved_row();

-- --- Withdrawals: submitted ---
CREATE OR REPLACE FUNCTION public.tp_notify_withdrawal_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt text := to_char(coalesce(NEW.amount, 0)::numeric, 'FM999999990.00');
BEGIN
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

REVOKE ALL ON FUNCTION public.tp_notify_withdrawal_inserted() FROM PUBLIC;
DROP TRIGGER IF EXISTS tp_notify_withdrawal_insert ON public.withdrawals;
CREATE TRIGGER tp_notify_withdrawal_insert
AFTER INSERT ON public.withdrawals
FOR EACH ROW
EXECUTE PROCEDURE public.tp_notify_withdrawal_inserted();

-- --- Withdrawals: approved ---
CREATE OR REPLACE FUNCTION public.tp_notify_withdrawal_approved_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt text := to_char(coalesce(NEW.amount, 0)::numeric, 'FM999999990.00');
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    NEW.user_id,
    NEW.investor_email,
    'Withdrawal completed',
    format('Your withdrawal for $%s was approved.', amt),
    'withdrawal_approved'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tp_notify_withdrawal_approved_row() FROM PUBLIC;
DROP TRIGGER IF EXISTS tp_notify_withdrawal_approved ON public.withdrawals;
CREATE TRIGGER tp_notify_withdrawal_approved
AFTER UPDATE ON public.withdrawals
FOR EACH ROW
EXECUTE PROCEDURE public.tp_notify_withdrawal_approved_row();

-- --- Support ticket opened (investor) + admin ---
CREATE OR REPLACE FUNCTION public.tp_notify_ticket_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.tp_emit_investor_notification(
    NULL,
    NEW.investor_email,
    'Support ticket opened',
    format('Ticket “%s” was received. We will reply shortly.', NEW.subject),
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
DROP TRIGGER IF EXISTS tp_notify_ticket_insert ON public.support_tickets;
CREATE TRIGGER tp_notify_ticket_insert
AFTER INSERT ON public.support_tickets
FOR EACH ROW
EXECUTE PROCEDURE public.tp_notify_ticket_inserted();

-- --- Profit row created from admin ---
CREATE OR REPLACE FUNCTION public.tp_notify_profit_row_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt text := to_char(coalesce(NEW.amount, 0)::numeric, 'FM999999990.00');
BEGIN
  PERFORM public.tp_emit_investor_notification(
    NEW.user_id,
    NEW.investor_email,
    'Profit recorded',
    coalesce(trim(NEW.description), format('Profit of $%s was credited to your account.', amt)),
    'profit_bonus'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tp_notify_profit_row_inserted() FROM PUBLIC;
DROP TRIGGER IF EXISTS tp_notify_profit_insert ON public.profits;
CREATE TRIGGER tp_notify_profit_insert
AFTER INSERT ON public.profits
FOR EACH ROW
EXECUTE PROCEDURE public.tp_notify_profit_row_inserted();

-- Principal lock matured (cron unlock)
CREATE OR REPLACE FUNCTION public.tp_notify_principal_lock_unlocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt text := to_char(coalesce(NEW.principal_amount, 0)::numeric, 'FM999999990.00');
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.matured IS NOT DISTINCT FROM NEW.matured THEN
    RETURN NEW;
  END IF;

  IF NEW.matured IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    NEW.user_id,
    NEW.investor_email,
    'Principal unlocked',
    format('$%s matured from locked principal is now withdrawable.', amt),
    'principal_unlocked'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tp_notify_principal_lock_unlocked() FROM PUBLIC;
DROP TRIGGER IF EXISTS tp_notify_principal_lock_mature ON public.principal_locks;
CREATE TRIGGER tp_notify_principal_lock_mature
AFTER UPDATE ON public.principal_locks
FOR EACH ROW
EXECUTE PROCEDURE public.tp_notify_principal_lock_unlocked();

-- Compound interest accruals (cron)
CREATE OR REPLACE FUNCTION public.mature_principal_locks(p_now timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT *
    FROM public.principal_locks
    WHERE matured = false
      AND locked_until <= p_now
    ORDER BY locked_until
    FOR UPDATE
  LOOP
    UPDATE public.principal_locks AS pl
    SET matured = true
    WHERE pl.id = rec.id;

    UPDATE public.investors AS inv
    SET
      locked_principal_balance = greatest(
        0::numeric,
        coalesce(inv.locked_principal_balance, 0)::numeric - rec.principal_amount::numeric
      ),
      withdrawable_balance = coalesce(inv.withdrawable_balance, 0)::numeric + rec.principal_amount::numeric
    WHERE inv.user_id = rec.user_id
       OR lower(trim(inv.email)) = lower(trim(rec.investor_email));
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.mature_principal_locks(timestamptz) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.apply_daily_compound_interest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_row public.investors%ROWTYPE;
  pct numeric;
  delta numeric;
  min_since interval := interval '23 hours';
  delta_txt text;
BEGIN
  FOR inv_row IN SELECT * FROM public.investors LOOP
    IF coalesce(trim(inv_row.status), '') <> 'active' THEN
      CONTINUE;
    END IF;

    IF coalesce(inv_row.balance, 0) <= 0 THEN
      CONTINUE;
    END IF;

    IF inv_row.last_compound_at IS NOT NULL
       AND inv_row.last_compound_at > (NOW() AT TIME ZONE 'UTC') - min_since THEN
      CONTINUE;
    END IF;

    pct := public.daily_compound_percent_for_plan(inv_row.investment_plan) / 100.0;
    delta := round(coalesce(inv_row.balance, 0)::numeric * pct, 8);

    IF delta <= 0 THEN
      UPDATE public.investors
      SET last_compound_at = (NOW() AT TIME ZONE 'UTC')
      WHERE id = inv_row.id;
      CONTINUE;
    END IF;

    UPDATE public.investors
    SET
      balance = coalesce(balance, 0)::numeric + delta,
      withdrawable_balance = coalesce(withdrawable_balance, 0)::numeric + delta,
      total_profit = coalesce(total_profit, 0)::numeric + delta,
      last_compound_at = (NOW() AT TIME ZONE 'UTC')
    WHERE id = inv_row.id;

    delta_txt := to_char(delta, 'FM999999990.00000000');
    PERFORM public.tp_emit_investor_notification(
      inv_row.user_id,
      inv_row.email,
      'Profit credited',
      format('Daily compound added $%s based on your %s tier returns.', delta_txt, coalesce(trim(inv_row.investment_plan), 'current')),
      'profit_compound'
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_daily_compound_interest() FROM PUBLIC;
