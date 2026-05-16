/**
 * PostgREST `ilike` treats `_`/`%` as wildcards — escape those (and `\`) so the
 * filter matches exactly one canonical email regardless of casing, aligned with
 * RLS + investor_unread_notifications_count (lower(trim(...)) comparison).
 */
function escapeExactIlikeEmailLiteral(emailTrimmed: string): string {
  return emailTrimmed
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/** Shared `.or(...)` clause for investor-owned rows — notifications, profits, … — aligned with RLS. */
export function notificationsOwnerOrFilter(opts: {
  userId: string;
  investorEmail?: string | null;
}) {
  const email = opts.investorEmail?.trim();
  if (email && email.length > 0) {
    const escaped = escapeExactIlikeEmailLiteral(email);
    const operand =
      escaped.includes(",") ||
      escaped.includes("(") ||
      escaped.includes(")")
        ? `*${escaped}*`
        : escaped;

    return `user_id.eq.${opts.userId},investor_email.ilike.${operand}`;
  }
  return `user_id.eq.${opts.userId}`;
}