function normalizeSiteOrigin(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * In production, when `NEXT_PUBLIC_SITE_URL` is set, auth redirect helpers must not trust `Host`
 * (open redirect / cache poisoning). Callers still attach **path-only** `next` via `sanitizeNextParam`.
 */
export function getProductionCanonicalSiteOrigin(): string | null {
  if (process.env.NODE_ENV !== "production") return null;
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!envUrl || !/^https?:\/\//i.test(envUrl)) return null;
  return normalizeSiteOrigin(envUrl);
}

/**
 * Origin derived from the incoming request (Vercel: `x-forwarded-host` / `x-forwarded-proto`),
 * except in production with `NEXT_PUBLIC_SITE_URL` set — then that canonical origin wins.
 */
export function getRequestSiteOrigin(request: Request): string {
  const canonical = getProductionCanonicalSiteOrigin();
  if (canonical) return canonical;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host");
  const protoHeader =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "";

  const host =
    forwardedHost?.split(",")[0]?.trim() ||
    hostHeader?.split(",")[0]?.trim();
  if (host && !/[\s\\/]/.test(host)) {
    const proto =
      protoHeader === "http" || protoHeader === "https"
        ? protoHeader
        : host.startsWith("localhost") || host.startsWith("127.")
          ? "http"
          : "https";
    return `${proto}://${host}`.replace(/\/+$/, "");
  }

  return getServerSiteOrigin();
}

/**
 * Trusted site origin for server-side auth redirects (API routes).
 * Prefer `NEXT_PUBLIC_SITE_URL`; on Vercel fall back to `VERCEL_URL` (may not match custom domain).
 */
export function getServerSiteOrigin(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl && /^https?:\/\//i.test(envUrl)) {
    return normalizeSiteOrigin(envUrl);
  }
  const v = process.env.VERCEL_URL?.trim();
  if (v) {
    const host = v.replace(/^https?:\/\//i, "").split("/")[0]?.trim();
    if (host && !/[\s\\/]/.test(host)) return `https://${host}`;
  }
  return "http://localhost:3000";
}
