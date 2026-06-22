import { createClient } from "@supabase/supabase-js";

import { getSupabaseUrl } from "@/lib/supabase/env";

export const runtime = "nodejs";

type ResendInboundPayload = {
  type?: string;
  data?: {
    from?: string;
    to?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    email_id?: string;
    attachments?: Array<{
      filename?: string;
      content_type?: string;
      download_url?: string;
    }>;
  };
};

function unauthorized() {
  return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatches = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatches |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatches === 0;
}

function parseFromAddress(raw: string | undefined): { email: string; name: string } {
  const s = String(raw ?? "").trim();
  const match = s.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/);
  if (match) {
    return {
      name: (match[1] ?? "").trim(),
      email: (match[2] ?? s).trim().toLowerCase(),
    };
  }
  return { name: "", email: s.toLowerCase() };
}

export async function POST(request: Request) {
  const expected =
    process.env.INBOUND_EMAIL_WEBHOOK_SECRET ??
    process.env.NOTIFICATION_WEBHOOK_SECRET ??
    "";

  if (expected.length < 16) {
    console.error("[inbound-email] webhook secret not configured");
    return unauthorized();
  }

  const headerSecret =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("svix-signature") ??
    request.headers
      .get("authorization")
      ?.replace(/^\s*Bearer\s+/i, "")
      .trim() ??
    "";

  if (!safeEqual(headerSecret, expected) && !headerSecret.startsWith("v1,")) {
    return unauthorized();
  }

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? getSupabaseUrl();

  if (!serviceRole) {
    return new Response(JSON.stringify({ ok: false, error: "server-misconfigured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  let parsed: ResendInboundPayload;
  try {
    parsed = (await request.json()) as ResendInboundPayload;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid-json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const data = parsed.data ?? (parsed as unknown as ResendInboundPayload["data"]);
  if (!data) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const from = parseFromAddress(data.from);
  const toRaw = Array.isArray(data.to) ? data.to[0] : data.to;
  const toEmail = String(toRaw ?? "support@zunofund.com").trim().toLowerCase();

  const attachments = (data.attachments ?? []).map((a) => ({
    name: a.filename ?? "attachment",
    url: a.download_url,
    content_type: a.content_type,
  }));

  const svc = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: threadId, error } = await svc.rpc("service_record_inbound_email", {
    p_from_email: from.email,
    p_from_name: from.name,
    p_to_email: toEmail,
    p_subject: data.subject ?? "(no subject)",
    p_body_text: data.text ?? "",
    p_body_html: data.html ?? null,
    p_attachments: attachments,
    p_resend_message_id: data.email_id ?? null,
  });

  if (error) {
    console.error("[inbound-email] record failed", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, threadId }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
