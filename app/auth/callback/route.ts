import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { sanitizeNextParam } from "@/lib/authLinks";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * PKCE / server-side exchange for Supabase auth emails (signup verification, magic links, password recovery).
 * Supabase redirects here with `?code=…`; we set session cookies then send the user to `next`.
 */
export async function GET(request: NextRequest) {
  const reqUrl = new URL(request.url);
  const origin = reqUrl.origin;
  const code = reqUrl.searchParams.get("code");
  const nextPath = sanitizeNextParam(reqUrl.searchParams.get("next")) ?? "/dashboard";

  if (!code) {
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
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const u = new URL("/auth", origin);
    u.searchParams.set("error", error.message);
    return NextResponse.redirect(u);
  }

  return response;
}
