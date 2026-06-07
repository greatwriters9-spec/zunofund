export function isRecaptchaSiteKeyConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim());
}
