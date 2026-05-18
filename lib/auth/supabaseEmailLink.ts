/**
 * Detect Supabase Auth email-link payloads (query or URL hash).
 * Used on `/` when Supabase falls back to Site URL and on `/auth/callback` client page.
 */

export const SUPABASE_EMAIL_LINK_OTP_TYPES = new Set([
  "recovery",
  "email",
  "signup",
  "email_change",
  /** Legacy magic-link confirmations still seen in some Auth templates. */
  "magiclink",
  "invite",
]);

export function supabaseAuthHashLooksLikeSession(fragmentWithoutLeadingHash: string): boolean {
  const h = fragmentWithoutLeadingHash;
  if (!h) return false;
  return (
    h.includes("access_token") ||
    h.includes("refresh_token") ||
    /\btype=recovery\b/.test(h) ||
    /\btype=signup\b/.test(h) ||
    /\btype=email\b/.test(h) ||
    /\btype=magiclink\b/.test(h)
  );
}

export function authRedirectLooksLikePasswordRecovery(url: URL): boolean {
  const t = (url.searchParams.get("type") ?? "").toLowerCase();
  const hash = url.hash.slice(1).toLowerCase();
  return t === "recovery" || hash.includes("type=recovery");
}

export function urlLooksLikeSupabaseAuthRedirect(url: URL): boolean {
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") ?? "";
  const hash = url.hash.slice(1);
  return (
    Boolean(code) ||
    Boolean(tokenHash && SUPABASE_EMAIL_LINK_OTP_TYPES.has(type)) ||
    supabaseAuthHashLooksLikeSession(hash)
  );
}

/** When Site URL is `/`, route magic-link params to signup confirm vs password reset. */
export function landingAuthForwardPath(url: URL): "/auth/callback" | "/reset-password" | null {
  if (!urlLooksLikeSupabaseAuthRedirect(url)) return null;
  return authRedirectLooksLikePasswordRecovery(url) ? "/reset-password" : "/auth/callback";
}
