import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { sanitizeNextParam } from "@/lib/authLinks";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

/** Query `type` values Supabase may append to magic-link / confirmation URLs. */
function allowedOtpType(raw: string): raw is "signup" | "email_change" | "recovery" | "email" {
  return (
    raw === "signup" ||
    raw === "email_change" ||
    raw === "recovery" ||
    raw === "email"
  );
}

/**
 * PKCE (`?code=`) or legacy OTP (`token_hash` + `type`) from Supabase Auth emails.
 */
export async function GET(request: NextRequest) {
  const reqUrl = new URL(request.url);
  const origin = reqUrl.origin;
  const code = reqUrl.searchParams.get("code");
  const tokenHash = reqUrl.searchParams.get("token_hash");
  const otpTypeRaw = reqUrl.searchParams.get("type") ?? "";
  const nextPath = sanitizeNextParam(reqUrl.searchParams.get("next")) ?? "/dashboard";

  if (!code && !(tokenHash && allowedOtpType(otpTypeRaw))) {
    const u = new URL("/auth", origin);
    u.searchParams.set("error", "missing_code");
    return NextResponse.redirect(u);
  }

  let response = NextResponse.redirect(new URL(nextPath, origin));

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers ?? {}).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const u = new URL("/auth", origin);
      u.searchParams.set("error", error.message);
      return NextResponse.redirect(u);
    }
    return response;
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash!,
    type: otpTypeRaw as "signup" | "email_change" | "recovery" | "email",
  });

  if (error) {
    const u = new URL("/auth", origin);
    u.searchParams.set("error", error.message);
    return NextResponse.redirect(u);
  }

  return response;
}
