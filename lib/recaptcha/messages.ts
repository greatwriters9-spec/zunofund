export const RECAPTCHA_MESSAGES = {
  incomplete: "Please complete the reCAPTCHA challenge.",
  failed: "Verification failed. Please try again.",
  expired: "Security verification expired. Please retry.",
  loading: "Loading security verification…",
  loadFailed: "Security verification could not be loaded. Please try again.",
  notConfigured:
    "Security verification is unavailable. Add NEXT_PUBLIC_RECAPTCHA_SITE_KEY to your environment and restart the dev server.",
} as const;

export type RecaptchaErrorCode = "incomplete" | "failed" | "expired";

export function recaptchaMessageForCode(
  code: RecaptchaErrorCode | string | undefined,
): string {
  if (code === "incomplete") return RECAPTCHA_MESSAGES.incomplete;
  if (code === "expired") return RECAPTCHA_MESSAGES.expired;
  return RECAPTCHA_MESSAGES.failed;
}
