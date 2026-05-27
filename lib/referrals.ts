export function normalizeReferralCodeInput(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function buildReferralSignupPath(code: string | null | undefined): string {
  const normalized = normalizeReferralCodeInput(code);
  return normalized ? `/auth?signup=1&ref=${encodeURIComponent(normalized)}` : "/auth?signup=1";
}
