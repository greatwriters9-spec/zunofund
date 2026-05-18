-- Fix outbound email webhooks: production host + columns expected by /api/webhooks/notify-email.
-- Requires NOTIFICATION_WEBHOOK_SECRET on Vercel to match x-webhook-secret below (rotate together if needed).

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'general';

ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

DROP TRIGGER IF EXISTS "Send Email Notifications" ON public.notifications;

CREATE TRIGGER "Send Email Notifications"
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION supabase_functions.http_request(
  'https://zunofund.com/api/webhooks/notify-email',
  'POST',
  '{"Content-Type":"application/json","x-webhook-secret":"zuno_super_secret_2026"}',
  '{}',
  '5000'
);

DROP TRIGGER IF EXISTS "Send Admin Email Notifications" ON public.admin_notifications;

CREATE TRIGGER "Send Admin Email Notifications"
AFTER INSERT ON public.admin_notifications
FOR EACH ROW
EXECUTE FUNCTION supabase_functions.http_request(
  'https://zunofund.com/api/webhooks/notify-email',
  'POST',
  '{"Content-Type":"application/json","x-webhook-secret":"zuno_super_secret_2026"}',
  '{}',
  '5000'
);
