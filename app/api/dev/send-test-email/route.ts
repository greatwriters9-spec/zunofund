import { getEmailBrandWithPlatformContact } from "@/lib/email/brandWithPlatformContact";
import { siteOriginFromRequest } from "@/lib/email/request-origin";
import { buildZunoEmailHtml } from "@/lib/email/zuno-layout";

export const runtime = "nodejs";

/**
 * Manual Resend smoke test with a simple JSON body (same secret as notify-email webhook).
 * POST /api/dev/send-test-email
 * Header: x-webhook-secret: NOTIFICATION_WEBHOOK_SECRET
 * Body: { "email": "...", "subject": "...", "message": "..." }
 *
 * Disabled in production (`404`) so the endpoint is not discoverable on prod deployments.
 */

function unauthorized() {
  return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let mismatches = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatches |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatches === 0;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }

  const expected = process.env.NOTIFICATION_WEBHOOK_SECRET ?? "";
  if (expected.length < 16) {
    return unauthorized();
  }

  const headerSecret =
    request.headers.get("x-webhook-secret") ??
    request.headers
      .get("authorization")
      ?.replace(/^\s*Bearer\s+/i, "")
      .trim() ??
    "";

  if (!safeEqual(headerSecret, expected)) {
    return unauthorized();
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid-json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const body = parsed as {
    email?: string;
    subject?: string;
    message?: string;
  };

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!email.includes("@") || subject.length === 0 || message.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: "invalid-body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const key = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.NOTIFY_FROM_EMAIL?.trim();

  if (!key || !from) {
    return new Response(
      JSON.stringify({ ok: false, error: "resend-not-configured" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const brand = await getEmailBrandWithPlatformContact({
    preferSiteUrl: siteOriginFromRequest(request),
  });

  const html = buildZunoEmailHtml({
    variant: "investor",
    title: subject,
    bodyText: message,
    brand,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      html,
    }),
  });

  const resBody = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("[send-test-email] Resend error", res.status, resBody);
    return new Response(
      JSON.stringify({ ok: false, status: res.status, error: resBody }),
      {
        status: 502,
        headers: { "content-type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ ok: true, resend: resBody }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
