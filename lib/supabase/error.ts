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

/** User-safe copy in production; preserves details in development. */
export function formatSupabaseError(error: unknown): string {
  if (error == null) {
    return "Something went wrong. Please try again.";
  }

  const debug = process.env.NODE_ENV === "development";

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
    return "Something went wrong. Please try again.";
  }

  if (error instanceof Error && error.message) {
    return debug ? error.message : "Something went wrong. Please try again.";
  }

  return "Something went wrong. Please try again.";
}
