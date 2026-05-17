/**
 * Shared helpers for routing the unauthenticated experience.
 *
 * Pages and middleware can preserve a `?next=…` query so that — once the
 * visitor signs in or signs up — they land on the page they were originally
 * trying to reach (typically a deep link into `/dashboard` etc.).
 */

/**
 * Returns the input only if it is a safe, internal path.
 *
 * Anything that is not a string starting with a single `/` (i.e. external
 * URLs, protocol-relative `//host`, or empty values) is rejected — the caller
 * gets `null` and should fall back to its default destination.
 */
export function sanitizeNextParam(
  raw: string | null | undefined,
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  return trimmed;
}

/** Build a `/auth` URL that preserves the optional post-login destination. */
export function loginHref(nextRaw: string | null | undefined): string {
  const next = sanitizeNextParam(nextRaw);
  return next ? `/auth?next=${encodeURIComponent(next)}` : "/auth";
}

/** Build a `/auth?signup=1` URL that preserves the optional destination. */
export function signupHref(nextRaw: string | null | undefined): string {
  const next = sanitizeNextParam(nextRaw);
  return next
    ? `/auth?signup=1&next=${encodeURIComponent(next)}`
    : "/auth?signup=1";
}
