/** Admin-assignable merchant countries (display + flag). */
export const MERCHANT_COUNTRIES = [
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "IN", name: "India", flag: "🇮🇳" },
] as const;

export type MerchantCountryCode = (typeof MERCHANT_COUNTRIES)[number]["code"];

export function merchantCountryLabel(code: string | null | undefined): string | null {
  if (!code?.trim()) return null;
  const hit = MERCHANT_COUNTRIES.find(
    (c) => c.code === code.toUpperCase() || c.name.toLowerCase() === code.trim().toLowerCase(),
  );
  return hit?.name ?? code.trim();
}

export function merchantCountryFlag(code: string | null | undefined): string {
  if (!code?.trim()) return "🌍";
  const hit = MERCHANT_COUNTRIES.find(
    (c) => c.code === code.toUpperCase() || c.name.toLowerCase() === code.trim().toLowerCase(),
  );
  return hit?.flag ?? "🌍";
}

export function formatMerchantCountry(code: string | null | undefined): string | null {
  const name = merchantCountryLabel(code);
  if (!name) return null;
  return `${merchantCountryFlag(code)} ${name}`;
}
