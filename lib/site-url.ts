/**
 * Canonical origin for Supabase auth redirects (password recovery, email verification).
 *
 * - Prefer `NEXT_PUBLIC_SITE_URL` in production builds (must match Supabase “Site URL” / redirect allow-list).
 * - In the browser, falls back to `window.location.origin` so forgot-password still works if env was misconfigured.
 * - During local SSR/prerender, defaults to localhost.
 */
export function getPublicSiteOrigin(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl && /^https?:\/\//i.test(envUrl)) {
    return envUrl.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}

/** Absolute URL for `redirectTo` / `emailRedirectTo` (internal paths only). */
export function authRedirectToUrl(
  pathWithLeadingSlash: string,
  query?: Record<string, string>,
): string {
  const base = getPublicSiteOrigin();
  const path = pathWithLeadingSlash.startsWith("/")
    ? pathWithLeadingSlash
    : `/${pathWithLeadingSlash}`;
  const u = new URL(path, `${base}/`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      u.searchParams.set(k, v);
    }
  }
  return u.toString();
}

/**
 * Password-reset links must use the **origin the user is actually on** when possible.
 * If `NEXT_PUBLIC_SITE_URL` is stale (www vs apex, preview vs production), Supabase rejects
 * `redirectTo` as not allowed and recover fails.
 */
export function browserAuthRedirectToUrl(pathWithLeadingSlash: string): string {
  if (typeof window !== "undefined") {
    const origin = window.location.origin.replace(/\/+$/, "");
    const path = pathWithLeadingSlash.startsWith("/")
      ? pathWithLeadingSlash
      : `/${pathWithLeadingSlash}`;
    return new URL(path, `${origin}/`).toString();
  }
  return authRedirectToUrl(pathWithLeadingSlash);
}
