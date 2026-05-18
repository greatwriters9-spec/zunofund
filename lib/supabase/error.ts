import type { AuthError } from "@supabase/supabase-js";
import type { PostgrestError } from "@supabase/supabase-js";

export function isSupabaseError(e: unknown): e is PostgrestError | AuthError {
  return (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
  );
}

function authErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }
  const c = (error as { code?: unknown }).code;
  return typeof c === "string" ? c : null;
}

/** Supabase built-in auth mail hits tight quotas; custom SMTP removes most caps. */
function isAuthEmailRateLimited(error: unknown): boolean {
  const code = authErrorCode(error);
  if (code === "over_email_send_rate_limit") return true;
  if (!isSupabaseError(error)) return false;
  const m = error.message.toLowerCase();
  return /rate limit|too many emails|email rate|over_email_send/.test(m);
}

/** User-safe copy in production; preserves details in development. */
export function formatSupabaseError(error: unknown): string {
  if (error == null) {
    return "Something went wrong. Please try again.";
  }

  const debug = process.env.NODE_ENV === "development";

  if (isAuthEmailRateLimited(error) && isSupabaseError(error)) {
    if (debug) return error.message;
    return (
      "Too many authentication emails were sent (Supabase’s built-in mail limit). " +
      "Wait before trying again, or fix permanently: Supabase Dashboard → Authentication → Emails → SMTP → enable Custom SMTP " +
      "with Resend (host smtp.resend.com, port 587, username resend, password = your Resend API key; sender must use a verified domain)."
    );
  }

  if (isSupabaseError(error) && error.message) {
    const m = error.message;
    if (debug) return m;
    if (
      /rate limit|already registered|already been registered|invalid login|email not confirmed|invalid credentials|password should|password must|email address is invalid|user already registered/i.test(
        m,
      )
    ) {
      return m;
    }
    /** Auth mail / redirect misconfig — hiding this makes reset look like a random failure. */
    if (
      /redirect|not allowed|invalid\s+.*url|oauth|email\s+.*send|smtp|mail\s+delivery|recover/i.test(
        m,
      )
    ) {
      return m;
    }
    return "Something went wrong. Please try again.";
  }

  if (error instanceof Error && error.message) {
    return debug ? error.message : "Something went wrong. Please try again.";
  }

  return "Something went wrong. Please try again.";
}
