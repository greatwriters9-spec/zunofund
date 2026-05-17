import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

const INVESTOR_PREFIXES = [
  "/dashboard",
  "/deposit",
  "/withdraw",
  "/history",
  "/notifications",
  "/support",
] as const;

function isInvestorProtectedPath(pathname: string) {
  return INVESTOR_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isAdminPath(pathname: string) {
  return (
    pathname.startsWith("/admin") &&
    pathname !== "/admin-login" &&
    !pathname.startsWith("/admin-login/")
  );
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((c) => {
    to.cookies.set(c.name, c.value);
  });
}

/** True if request carries Supabase browser session cookies (@supabase/ssr naming: sb-<ref>-auth-token...). */
function hasSupabaseSessionCookies(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name, value }) => {
    if (!name.startsWith("sb-")) return false;
    if (!value || value.length === 0) return false;
    return (
      name.includes("-auth-token") ||
      name.includes("-refresh-token")
    );
  });
}

/**
 * Refreshes Supabase auth cookies and applies route guards for investor + admin areas.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  const path = request.nextUrl.pathname;
  const isDev = process.env.NODE_ENV === "development";

  /*
   * 1) Prefer getUser() — verifies with Auth (needs Node → Supabase HTTPS; fails on broken TLS).
   * 2) In development only: fall back to getSession(), which reads the JWT from cookies and
   *    usually does not hit the network when the token is still valid.
   * 3) In development only: if we still have no uid, do NOT redirect investor routes away from
   *    `/dashboard` etc. Your browser still has a session; Postgres RLS still blocks bad reads.
   *    Production keeps strict redirects.
   */
  let uid: string | null = null;
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (!error) uid = user?.id ?? null;
  } catch {
    /* try fallbacks below */
  }

  if (!uid && isDev) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      uid = session?.user?.id ?? null;
    } catch {
      /* ignore */
    }
  }

  if (isInvestorProtectedPath(path) && !uid) {
    if (!isDev) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("next", `${path}${request.nextUrl.search}`);
      const redirect = NextResponse.redirect(url);
      copyCookies(response, redirect);
      return redirect;
    }
    // Dev: still block true logouts — no session cookies → not logged in.
    // Allow through only when cookies exist but getUser()/refresh failed (local TLS issue).
    if (!hasSupabaseSessionCookies(request)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("next", `${path}${request.nextUrl.search}`);
      const redirect = NextResponse.redirect(url);
      copyCookies(response, redirect);
      return redirect;
    }
  }

  if (isAdminPath(path)) {
    if (!uid) {
      const redirect = NextResponse.redirect(
        new URL("/admin-login", request.url)
      );
      copyCookies(response, redirect);
      return redirect;
    }

    try {
      const { data: adminRow } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", uid)
        .maybeSingle();

      if (!adminRow) {
        const redirect = NextResponse.redirect(new URL("/auth", request.url));
        copyCookies(response, redirect);
        return redirect;
      }
    } catch (e) {
      if (isDev) {
        console.error("[proxy] admin check failed:", e);
      }
      const redirect = NextResponse.redirect(
        new URL("/admin-login", request.url)
      );
      copyCookies(response, redirect);
      return redirect;
    }
  }

  return response;
}