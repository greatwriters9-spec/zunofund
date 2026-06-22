export type SendResendEmailOpts = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    content_type?: string;
  }>;
};

export type SendResendResult =
  | { ok: true; id?: string; skipped?: boolean }
  | { ok: false; status?: number; error: unknown };

export function getResendFromEmail(): string | null {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.NOTIFY_FROM_EMAIL?.trim() ||
    null
  );
}

export async function sendResendEmail(
  opts: SendResendEmailOpts,
): Promise<SendResendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[resend] RESEND_API_KEY missing — skipping email");
    return { ok: true, skipped: true };
  }

  const from = getResendFromEmail();
  if (!from) {
    console.warn("[resend] RESEND_FROM_EMAIL missing — skipping email");
    return { ok: true, skipped: true };
  }

  const to = Array.isArray(opts.to) ? opts.to : [opts.to];

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      reply_to: opts.replyTo,
      attachments: opts.attachments,
    }),
  });

  const bodyJson = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { ok: false, status: res.status, error: bodyJson };
  }

  const id =
    typeof bodyJson === "object" &&
    bodyJson !== null &&
    "id" in bodyJson &&
    typeof (bodyJson as { id: unknown }).id === "string"
      ? (bodyJson as { id: string }).id
      : undefined;

  return { ok: true, id };
}
