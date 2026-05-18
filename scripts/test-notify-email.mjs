/**
 * Smoke-test `/api/webhooks/notify-email` with a Supabase-shaped INSERT payload.
 *
 * Usage:
 *   node scripts/test-notify-email.mjs https://your-domain.com you@example.com
 *   node scripts/test-notify-email.mjs http://localhost:3000 you@example.com
 *
 * Requires in env (.env.local supported): NOTIFICATION_WEBHOOK_SECRET (≥16 chars),
 * SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL (for real sends).
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  const raw = readFileSync(p, "utf8").replace(/^\uFEFF/, "");
  for (let line of raw.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvLocal();

const baseUrl = (
  process.argv[2] ||
  process.env.NOTIFY_TEST_BASE_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const testTo = process.argv[3] || process.env.NOTIFY_TEST_EMAIL;
const secret = process.env.NOTIFICATION_WEBHOOK_SECRET ?? "";

if (secret.length < 16) {
  console.error(
    "Missing NOTIFICATION_WEBHOOK_SECRET (must be ≥16 chars). Add it to .env.local.",
  );
  process.exit(1);
}

if (!testTo || !String(testTo).includes("@")) {
  console.error(
    "Pass recipient email: node scripts/test-notify-email.mjs <baseUrl> <you@example.com>",
  );
  console.error("Or set NOTIFY_TEST_EMAIL in .env.local.");
  process.exit(1);
}

const body = {
  type: "INSERT",
  table: "notifications",
  schema: "public",
  record: {
    id: randomUUID(),
    investor_email: testTo.trim(),
    title: "Zuno email pipeline test",
    message:
      "If you received this in your inbox, Resend and /api/webhooks/notify-email are working.",
    type: "deposit_submitted",
    email_sent_at: null,
  },
};

const res = await fetch(`${baseUrl}/api/webhooks/notify-email`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-webhook-secret": secret,
  },
  body: JSON.stringify(body),
});

const text = await res.text();
console.log("HTTP", res.status);
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}
