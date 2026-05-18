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
