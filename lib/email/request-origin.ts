/**
 * Derive an absolute site origin from an incoming HTTP request (server-side).
 * Used when env omits NEXT_PUBLIC_SITE_URL so transactional emails still get
 * absolute dashboard / asset URLs (email clients cannot resolve relative paths).
 */
export function siteOriginFromRequest(request: Request): string | null {
  const rawHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    request.headers.get("host")?.trim();
  if (!rawHost || rawHost.length > 253) return null;
  if (/[\s\\/]/.test(rawHost)) return null;

  const protoRaw =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    "https";
  const proto = protoRaw.toLowerCase();
  if (proto !== "http" && proto !== "https") return null;

  return `${proto}://${rawHost}`;
}
