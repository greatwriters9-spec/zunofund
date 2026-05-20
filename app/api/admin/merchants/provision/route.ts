import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

function augmentMerchantRpcError(message: string): string {
  if (/schema cache|could not find the function/i.test(message)) {
    return `${message} Apply P2P merchant migrations to this Supabase project (see docs/supabase-p2p-merchant-setup.md), especially 20260619200000_admin_only_merchant_registration.sql.`;
  }
  return message;
}

export async function POST(request: Request) {
  let body: {
    email?: string;
    displayName?: string | null;
    activateImmediately?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const displayName = body.displayName != null ? String(body.displayName).trim() : "";
  const activateImmediately = body.activateImmediately !== false;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
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

  const { data: existingInv, error: invErr } = await supabase
    .from("investors")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();

  if (invErr) {
    return NextResponse.json({ error: invErr.message }, { status: 400 });
  }

  const userId = (existingInv?.user_id as string | undefined) ?? null;
  if (!userId) {
    return NextResponse.json(
      {
        error:
          "No investor account exists for that email. Merchants must already be registered investors — ask them to sign up first, then provision again.",
      },
      { status: 400 },
    );
  }

  const registerArgs =
    displayName.length > 0
      ? { p_user_id: userId, p_display_name: displayName }
      : { p_user_id: userId };

  const { error: regErr } = await supabase.rpc(
    "admin_register_merchant_candidate",
    registerArgs,
  );

  if (regErr) {
    return NextResponse.json(
      { error: augmentMerchantRpcError(regErr.message) },
      { status: 400 },
    );
  }

  if (activateImmediately) {
    const { error: apprErr } = await supabase.rpc("admin_review_merchant_application", {
      p_user_id: userId,
      p_approve: true,
      p_note: null,
    });
    if (apprErr) {
      return NextResponse.json(
        { error: augmentMerchantRpcError(apprErr.message) },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    userId,
    email,
    activated: activateImmediately,
  });
}
