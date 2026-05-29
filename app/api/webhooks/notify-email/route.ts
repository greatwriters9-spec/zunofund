import { createClient } from "@supabase/supabase-js";

import { getEmailBrandWithPlatformContact } from "@/lib/email/brandWithPlatformContact";
import { formatUsdAmountsInText } from "@/lib/formatMoney";
import { siteOriginFromRequest } from "@/lib/email/request-origin";
import { buildZunoEmailHtml } from "@/lib/email/zuno-layout";
import { getSupabaseUrl } from "@/lib/supabase/env";

export const runtime = "nodejs";

type SupabaseWebhookBody = {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, unknown> | null;
};

function unauthorized() {
  return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

const jsonHdr = { "content-type": "application/json" };

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: jsonHdr });
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

function investorEmailSubject(
  type: string,
  title: string | undefined,
  brandTag: string,
): string {
  const t = type.toLowerCase();
  const base = `[${brandTag}]`;
  if (t.includes("deposit_submitted"))
    return `${base} Deposit request received`;
  if (t.includes("account_verify_reminder"))
    return `${base} Welcome — verify your email`;
  if (t.includes("deposit_approved")) return `${base} Deposit approved`;
  if (t.includes("withdrawal_submitted"))
    return `${base} Withdrawal submitted`;
  if (t.includes("withdrawal_approved"))
    return `${base} Withdrawal completed`;
  if (t.includes("referral_bonus")) return `${base} Referral bonus credited`;
  if (t.includes("profit_bonus")) return `${base} Profit recorded`;
  if (t.includes("profit_compound")) return `${base} Profit credited`;
  if (t.includes("p2p_dispute")) return `${base} P2P dispute update`;
  if (t.includes("p2p_message")) return `${base} New P2P message`;
  if (t.includes("p2p_trade")) return `${base} New P2P trade`;
  if (t.includes("principal_unlocked")) return `${base} Principal unlocked`;
  if (t.includes("support_reply")) return `${base} Support message`;
  if (t.includes("support_ticket_opened"))
    return `${base} Ticket received`;

  const raw = typeof title === "string" ? title.trim() : "";
  return raw ? `${base} ${raw}` : `${base} Account update`;
}

function adminEmailSubject(type: string | undefined, brandTag: string): string {
  const t = (type ?? "").toLowerCase();
  const base = `[${brandTag} Admin]`;
  if (t.includes("pending_deposit")) return `${base} Pending deposit`;
  if (t.includes("pending_withdrawal")) return `${base} Pending withdrawal`;
  if (t.includes("new_ticket")) return `${base} New support ticket`;
  return `${base} Operations alert`;
}

async function sendResend(opts: {
  to: string;
  subject: string;
  html: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.length === 0) {
    console.warn("[notify-email] RESEND_API_KEY missing — skipping email");
    return { ok: true as const, skipped: true as const };
  }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.NOTIFY_FROM_EMAIL?.trim();

  if (!from) {
    console.warn("[notify-email] RESEND_FROM_EMAIL missing — skipping email");
    return { ok: true as const, skipped: true as const };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });

  const bodyJson = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("[notify-email] Resend error", res.status, bodyJson);
    return {
      ok: false as const,
      status: res.status,
      body: bodyJson,
    };
  }

  return { ok: true as const, skipped: false as const };
}

export async function POST(request: Request) {
  const expected = process.env.NOTIFICATION_WEBHOOK_SECRET ?? "";
  if (expected.length < 16) {
    console.error(
      "[notify-email] NOTIFICATION_WEBHOOK_SECRET must be configured (≥16 chars).",
    );
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

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? getSupabaseUrl();

  if (!serviceRole) {
    console.error("[notify-email] SUPABASE_SERVICE_ROLE_KEY missing.");
    return new Response(
      JSON.stringify({ ok: false, error: "server-misconfigured" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const brand = await getEmailBrandWithPlatformContact({
    preferSiteUrl: siteOriginFromRequest(request),
  });

  const svc = createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  let parsed: SupabaseWebhookBody;
  try {
    parsed = (await request.json()) as SupabaseWebhookBody;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid-json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const record = parsed.record ?? null;
  if (!record || parsed.type !== "INSERT") {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const table =
    typeof parsed.table === "string" ? parsed.table : undefined;

  if (!table) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  if (table === "notifications") {
    const id =
      typeof record.id === "string"
        ? record.id
        : typeof record.id === "number"
          ? String(record.id)
          : null;
    const to =
      typeof record.investor_email === "string"
        ? record.investor_email.trim()
        : "";
    const title =
      typeof record.title === "string"
        ? record.title
        : "Account notification";
    const bodyMsg = formatUsdAmountsInText(
      typeof record.message === "string"
        ? record.message
        : "You have a new notification in-app.",
    );
    const notifType =
      typeof record.type === "string" ? record.type : "notification";

    if (notifType.toLowerCase().includes("p2p_message_online")) {
      return jsonResponse({ ok: true, skipped: "investor-online" });
    }

    /*
     * Signup email verification must come from Supabase Auth only — it contains the
     * signed confirmation URL. Our Zuno layout always CTAs `dashboardUrl`, which
     * sends unverified users to `/dashboard` → proxy redirects to `/` (looks “broken”).
     * Duplicate mail also hurts trust/spam scores.
     */
    if (notifType.toLowerCase().includes("account_verify_reminder")) {
      return jsonResponse({
        ok: true,
        skipped: "account-verify-supabase-auth-email-only",
      });
    }

    if (!id || !to.includes("@")) {
      return jsonResponse({ ok: true, skipped: "missing-target" });
    }

    if (
      typeof record.email_sent_at === "string" &&
      record.email_sent_at.length > 1
    ) {
      return jsonResponse({ ok: true, skipped: "already-mailed" });
    }

    const subject = investorEmailSubject(notifType, title, brand.brandName);
    const html = buildZunoEmailHtml({
      variant: "investor",
      title,
      bodyText: bodyMsg,
      footnoteText:
        "Prefer in-app alerts? Stay signed in — we ping you instantly when something changes.",
      brand,
    });

    const mailed = await sendResend({
      to,
      subject,
      html,
    });

    if (mailed.ok && !mailed.skipped) {
      const { error } = await svc
        .from("notifications")
        .update({
          email_sent_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        console.error("[notify-email] Failed to mark emailed", error);
      }
    }

    return jsonResponse({ ok: true, notifications: mailed });
  }

  if (table === "admin_notifications") {
    const id =
      typeof record.id === "string"
        ? record.id
        : typeof record.id === "number"
          ? String(record.id)
          : null;

    const title =
      typeof record.title === "string"
        ? record.title
        : "Admin desk alert";
    const bodyMsg = formatUsdAmountsInText(
      typeof record.message === "string"
        ? record.message
        : "Open the Admin panel for details.",
    );
    const notifType =
      typeof record.type === "string" ? record.type : "admin";

    if (!id) {
      return jsonResponse({ ok: true, skipped: "missing-id" });
    }

    if (
      typeof record.email_sent_at === "string" &&
      record.email_sent_at.length > 1
    ) {
      return jsonResponse({ ok: true, skipped: "already-mailed" });
    }

    const { data: adminEmails, error: emailsError } = await svc.rpc(
      "service_list_admin_emails",
    );

    if (emailsError) {
      console.error("[notify-email] Failed to list admins", emailsError);
      return jsonResponse({ ok: false, error: emailsError }, 500);
    }

    type EmailRow = { email: string | null };

    const rows = Array.isArray(adminEmails)
      ? (adminEmails as EmailRow[])
      : [];

    const uniqueRecipients = [
      ...new Set(
        rows
          .map((r) => (typeof r.email === "string" ? r.email.trim() : ""))
          .filter(Boolean),
      ),
    ];

    const subject = adminEmailSubject(notifType, brand.brandName);
    const html = buildZunoEmailHtml({
      variant: "admin",
      title,
      bodyText: bodyMsg,
      brand,
    });

    let dispatched = false;
    for (const inbox of uniqueRecipients) {
      if (!inbox || !inbox.includes("@")) continue;

      const mailed = await sendResend({
        to: inbox,
        subject,
        html,
      });

      dispatched ||= mailed.ok === true && !mailed.skipped;
    }

    if (dispatched) {
      const { error } = await svc
        .from("admin_notifications")
        .update({
          email_sent_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        console.error("[notify-email] Failed to mark admin email", error);
      }
    }

    return jsonResponse({ ok: true, recipients: uniqueRecipients });
  }

  return new Response(JSON.stringify({ ok: true, ignored: table }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
