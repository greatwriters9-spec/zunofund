/**
 * Reads NOTIFICATION_WEBHOOK_SECRET and webhook base URL from `.env.local` and/or `process.env`,
 * then writes SQL to sync Postgres http_request triggers with /api/webhooks/notify-email.
 *
 * Usage: node scripts/sync-webhook-triggers-from-env.mjs
 *
 * Required:
 *   NOTIFICATION_WEBHOOK_SECRET (≥16 chars)
 *   One of WEBHOOK_NOTIFY_BASE_URL | SITE_URL | NEXT_PUBLIC_SITE_URL (absolute origin, https recommended)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");

/** @returns {Record<string, string>} */
function parseDotEnv(raw) {
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    const val = t
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    out[key] = val;
  }
  return out;
}

/** @returns {Record<string, string>} */
function loadDotEnvFile() {
  try {
    const raw = readFileSync(envPath, "utf8");
    return parseDotEnv(raw);
  } catch (e) {
    if (/** @type {{ code?: string }} */ (e).code === "ENOENT") return {};
    throw e;
  }
}

/**
 * @param {Record<string, string>} fileVars
 * @param {string} key
 */
function envLookup(fileVars, key) {
  const v = process.env[key]?.trim();
  if (v) return v;
  return fileVars[key]?.trim() ?? "";
}

/**
 * @param {string} raw
 */
function normalizeOrigin(raw) {
  const trimmed = String(raw).trim().replace(/\/+$/, "");
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
    console.error(
      "Webhook base URL must be an absolute http(s) origin (no path). Got:",
      JSON.stringify(raw),
    );
    process.exit(1);
  }
  return trimmed;
}

const fileVars = loadDotEnvFile();

const secret = envLookup(fileVars, "NOTIFICATION_WEBHOOK_SECRET");
if (!secret || secret.length < 16) {
  console.error(
    "NOTIFICATION_WEBHOOK_SECRET missing or shorter than 16 chars (check process.env and .env.local)",
  );
  process.exit(1);
}

const baseRaw =
  envLookup(fileVars, "WEBHOOK_NOTIFY_BASE_URL") ||
  envLookup(fileVars, "SITE_URL") ||
  envLookup(fileVars, "NEXT_PUBLIC_SITE_URL");

if (!baseRaw) {
  console.error(
    "Missing webhook notify base URL: set WEBHOOK_NOTIFY_BASE_URL, SITE_URL, or NEXT_PUBLIC_SITE_URL in environment or .env.local",
  );
  process.exit(1);
}

const base = normalizeOrigin(baseRaw);
const webhookUrl = `${base}/api/webhooks/notify-email`;

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
  ${sq(webhookUrl)},
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
  ${sq(webhookUrl)},
  'POST',
  ${sq(hdr)},
  '{}',
  '5000'
);
`.trim();

const out = resolve(process.cwd(), "supabase", ".temp_webhook_sync.sql");
writeFileSync(out, sql + "\n", "utf8");
console.error(
  "Wrote",
  out,
  "(secret length:",
  secret.length + ",",
  "notify URL:",
  webhookUrl + ")",
);
