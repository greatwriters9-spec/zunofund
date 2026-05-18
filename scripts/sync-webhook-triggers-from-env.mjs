/**
 * Reads NOTIFICATION_WEBHOOK_SECRET from .env.local and prints SQL to sync
 * Postgres http_request triggers with Vercel /api/webhooks/notify-email.
 * Usage: node scripts/sync-webhook-triggers-from-env.mjs > supabase/.temp_webhook_sync.sql
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
const raw = readFileSync(envPath, "utf8");
let secret = null;
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 1) continue;
  const key = t.slice(0, i).trim();
  if (key === "NOTIFICATION_WEBHOOK_SECRET") {
    secret = t
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    break;
  }
}

if (!secret || secret.length < 16) {
  console.error(
    "NOTIFICATION_WEBHOOK_SECRET missing or shorter than 16 chars in .env.local",
  );
  process.exit(1);
}

const hdr = JSON.stringify({
  "Content-Type": "application/json",
  "x-webhook-secret": secret,
});

const sq = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const sql = `
DROP TRIGGER IF EXISTS "Send Email Notifications" ON public.notifications;
CREATE TRIGGER "Send Email Notifications"
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION supabase_functions.http_request(
  'https://zunofund.com/api/webhooks/notify-email',
  'POST',
  ${sq(hdr)},
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
  ${sq(hdr)},
  '{}',
  '5000'
);
`.trim();

const out = resolve(process.cwd(), "supabase", ".temp_webhook_sync.sql");
writeFileSync(out, sql + "\n", "utf8");
console.error("Wrote", out, "(secret length:", secret.length + ")");
