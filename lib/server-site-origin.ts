/**
 * Origin derived from the incoming request (Vercel: `x-forwarded-host` / `x-forwarded-proto`).
 * Use for `redirectTo` / `emailRedirectTo` so confirmation links match the domain the user signed up on.
 */
export function getRequestSiteOrigin(request: Request): string {
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
    return envUrl.replace(/\/+$/, "");
  }
  const v = process.env.VERCEL_URL?.trim();
  if (v) {
    const host = v.replace(/^https?:\/\//i, "").split("/")[0]?.trim();
    if (host && !/[\s\\/]/.test(host)) return `https://${host}`;
  }
  return "http://localhost:3000";
}
