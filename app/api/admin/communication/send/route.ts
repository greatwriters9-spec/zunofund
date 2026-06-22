import { NextResponse } from "next/server";

import { getEmailBrandWithPlatformContact } from "@/lib/email/brandWithPlatformContact";
import { sendResendEmail } from "@/lib/email/resend";
import { buildZunoEmailHtml } from "@/lib/email/zuno-layout";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Body = {
  threadId?: string | null;
  to?: string;
  subject?: string;
  body?: string;
  saveDraft?: boolean;
  scheduledAt?: string | null;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const to = String(body.to ?? "").trim().toLowerCase();
  const subject = String(body.subject ?? "").trim();
  const text = String(body.body ?? "").trim();

  if (!to || !to.includes("@")) {
    return NextResponse.json({ error: "Valid recipient email required" }, { status: 400 });
  }
  if (!subject) {
    return NextResponse.json({ error: "Subject required" }, { status: 400 });
  }
  if (!text && !body.saveDraft) {
    return NextResponse.json({ error: "Message body required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const threadId = body.threadId?.trim() || null;

  if (body.saveDraft) {
    const { data: draftId, error } = await supabase.rpc("admin_save_email_draft", {
      p_thread_id: threadId,
      p_recipient_email: to,
      p_subject: subject,
      p_body_text: text,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, draftId, saved: true });
  }

  const brand = await getEmailBrandWithPlatformContact();
  const html = buildZunoEmailHtml({
    variant: "investor",
    title: subject,
    bodyText: text,
    brand,
  });

  const mailed = await sendResendEmail({
    to,
    subject: `[${brand.brandName}] ${subject}`,
    html,
    text,
    replyTo: brand.supportEmail || "support@zunofund.com",
  });

  if (!mailed.ok) {
    return NextResponse.json(
      { error: "Failed to send email", detail: mailed.error },
      { status: 502 },
    );
  }

  const { data: emailId, error: recordError } = await supabase.rpc(
    "admin_record_outbound_email",
    {
      p_thread_id: threadId,
      p_recipient_email: to,
      p_subject: subject,
      p_body_text: text,
      p_body_html: html,
      p_status: mailed.skipped ? "sent" : "sent",
      p_resend_message_id: mailed.ok && "id" in mailed ? mailed.id ?? null : null,
      p_attachments: [],
    },
  );

  if (recordError) {
    return NextResponse.json(
      { error: recordError.message, warning: "Email may have been sent but not recorded" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    emailId,
    resendId: mailed.ok && "id" in mailed ? mailed.id : null,
    skipped: mailed.ok && "skipped" in mailed ? mailed.skipped : false,
  });
}
