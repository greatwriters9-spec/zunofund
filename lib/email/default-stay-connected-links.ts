/**
 * Placeholder “Stay connected” row when `EMAIL_SOCIAL_LINKS` is unset.
 * Matches `email-preview` dev polish so production outbound mail mirrors what you signed off in the browser preview.
 *
 * Set `EMAIL_SOCIAL_LINKS` (Label|URL pairs) to replace this row with your real profiles.
 */
export const DEFAULT_STAY_CONNECTED_LINKS: { label: string; url: string }[] = [
  { label: "X", url: "https://x.com" },
  { label: "Telegram", url: "https://telegram.org" },
  { label: "LinkedIn", url: "https://linkedin.com" },
];
