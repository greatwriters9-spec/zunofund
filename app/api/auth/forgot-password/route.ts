import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerSiteOrigin } from "@/lib/server-site-origin";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export const runtime = "nodejs";

/**
 * Server-owned `redirectTo` so recovery emails never embed localhost from a stale client bundle.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const email =
    typeof body === "object" &&
    body !== null &&
    typeof (body as { email?: unknown }).email === "string"
      ? (body as { email: string }).email.trim()
      : "";

  if (!email.includes("@")) {
    return NextResponse.json({ ok: false, error: "invalid-email" }, { status: 400 });
  }

  const origin = getServerSiteOrigin();
  const next = encodeURIComponent("/reset-password");
  const redirectTo = `${origin}/auth/callback?next=${next}`;

  const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    console.warn("[forgot-password]", error.message);
  }

  return NextResponse.json({ ok: true });
}
