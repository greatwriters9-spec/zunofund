/**
 * `/email-preview` is disabled in production unless EMAIL_PREVIEW_SECRET is set
 * and the request includes ?secret=&lt;matching value&gt;.
 */
export function isEmailPreviewAllowed(secretFromQuery: string | undefined): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  const expected = process.env.EMAIL_PREVIEW_SECRET?.trim();
  if (!expected || expected.length < 8) {
    return false;
  }
  return typeof secretFromQuery === "string" && secretFromQuery === expected;
}
