-- Follow-up to 20260521103000_webhook_zunofund_production.sql:
-- that migration embedded a production hostname and a known webhook secret in trigger definitions.
-- Fresh installs must not ship those values; outbound email triggers must be provisioned per-environment.
--
-- After applying this migration (or any fresh DB created after it), recreate triggers from env using:
--   node scripts/sync-webhook-triggers-from-env.mjs
-- Then run the generated SQL (see script output path / stderr) in the Supabase SQL Editor with
-- NOTIFICATION_WEBHOOK_SECRET and WEBHOOK_NOTIFY_BASE_URL / SITE_URL / NEXT_PUBLIC_SITE_URL set.

DROP TRIGGER IF EXISTS "Send Email Notifications" ON public.notifications;

DROP TRIGGER IF EXISTS "Send Admin Email Notifications" ON public.admin_notifications;
