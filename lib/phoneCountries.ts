export type PhoneCountry = {
  iso2: string;
  name: string;
  flag: string;
  dial: string;
  minLen: number;
  maxLen: number;
};

export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { iso2: "KE", name: "Kenya", flag: "🇰🇪", dial: "254", minLen: 9, maxLen: 9 },
  { iso2: "UG", name: "Uganda", flag: "🇺🇬", dial: "256", minLen: 9, maxLen: 9 },
  { iso2: "TZ", name: "Tanzania", flag: "🇹🇿", dial: "255", minLen: 9, maxLen: 9 },
  { iso2: "RW", name: "Rwanda", flag: "🇷🇼", dial: "250", minLen: 9, maxLen: 9 },
  { iso2: "ET", name: "Ethiopia", flag: "🇪🇹", dial: "251", minLen: 9, maxLen: 9 },
  { iso2: "NG", name: "Nigeria", flag: "🇳🇬", dial: "234", minLen: 10, maxLen: 10 },
  { iso2: "GH", name: "Ghana", flag: "🇬🇭", dial: "233", minLen: 9, maxLen: 9 },
  { iso2: "ZA", name: "South Africa", flag: "🇿🇦", dial: "27", minLen: 9, maxLen: 9 },
  { iso2: "ZM", name: "Zambia", flag: "🇿🇲", dial: "260", minLen: 9, maxLen: 9 },
  { iso2: "EG", name: "Egypt", flag: "🇪🇬", dial: "20", minLen: 9, maxLen: 10 },
  { iso2: "MA", name: "Morocco", flag: "🇲🇦", dial: "212", minLen: 9, maxLen: 9 },
  { iso2: "US", name: "United States", flag: "🇺🇸", dial: "1", minLen: 10, maxLen: 10 },
  { iso2: "GB", name: "United Kingdom", flag: "🇬🇧", dial: "44", minLen: 10, maxLen: 10 },
  { iso2: "CA", name: "Canada", flag: "🇨🇦", dial: "1", minLen: 10, maxLen: 10 },
  { iso2: "AU", name: "Australia", flag: "🇦🇺", dial: "61", minLen: 9, maxLen: 9 },
  { iso2: "IN", name: "India", flag: "🇮🇳", dial: "91", minLen: 10, maxLen: 10 },
  { iso2: "AE", name: "UAE", flag: "🇦🇪", dial: "971", minLen: 9, maxLen: 9 },
  { iso2: "DE", name: "Germany", flag: "🇩🇪", dial: "49", minLen: 10, maxLen: 11 },
  { iso2: "FR", name: "France", flag: "🇫🇷", dial: "33", minLen: 9, maxLen: 9 },
  { iso2: "IT", name: "Italy", flag: "🇮🇹", dial: "39", minLen: 9, maxLen: 10 },
  { iso2: "ES", name: "Spain", flag: "🇪🇸", dial: "34", minLen: 9, maxLen: 9 },
  { iso2: "NL", name: "Netherlands", flag: "🇳🇱", dial: "31", minLen: 9, maxLen: 9 },
  { iso2: "CH", name: "Switzerland", flag: "🇨🇭", dial: "41", minLen: 9, maxLen: 9 },
  { iso2: "CN", name: "China", flag: "🇨🇳", dial: "86", minLen: 11, maxLen: 11 },
  { iso2: "JP", name: "Japan", flag: "🇯🇵", dial: "81", minLen: 10, maxLen: 10 },
  { iso2: "SG", name: "Singapore", flag: "🇸🇬", dial: "65", minLen: 8, maxLen: 8 },
  { iso2: "PK", name: "Pakistan", flag: "🇵🇰", dial: "92", minLen: 10, maxLen: 10 },
  { iso2: "BD", name: "Bangladesh", flag: "🇧🇩", dial: "880", minLen: 10, maxLen: 10 },
  { iso2: "SN", name: "Senegal", flag: "🇸🇳", dial: "221", minLen: 9, maxLen: 9 },
  { iso2: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", dial: "225", minLen: 10, maxLen: 10 },
  { iso2: "CM", name: "Cameroon", flag: "🇨🇲", dial: "237", minLen: 9, maxLen: 9 },
];

const BY_ISO = Object.fromEntries(PHONE_COUNTRIES.map((c) => [c.iso2, c]));
const BY_DIAL = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

export const DEFAULT_PHONE_COUNTRY = "KE";

export function getPhoneCountry(iso2: string): PhoneCountry {
  return BY_ISO[iso2] ?? BY_ISO[DEFAULT_PHONE_COUNTRY]!;
}

export function detectPhoneCountryIso(): string {
  if (typeof navigator === "undefined") return DEFAULT_PHONE_COUNTRY;
  const lang = (navigator.language || "").toUpperCase();
  const region = lang.split("-")[1];
  if (region && BY_ISO[region]) return region;
  return DEFAULT_PHONE_COUNTRY;
}

export function stripLeadingZeros(digits: string): string {
  return digits.replace(/^0+/, "");
}

export function nationalDigitsFromInput(raw: string): string {
  return stripLeadingZeros(raw.replace(/\D/g, ""));
}

export function toE164(country: PhoneCountry, nationalDigits: string): string {
  const n = stripLeadingZeros(nationalDigits.replace(/\D/g, ""));
  if (!n) return `+${country.dial}`;
  return `+${country.dial}${n}`;
}

export function parseE164(e164: string): { country: PhoneCountry; national: string } | null {
  const digits = e164.replace(/\D/g, "");
  if (!digits) return null;
  for (const c of BY_DIAL) {
    if (digits.startsWith(c.dial)) {
      return { country: c, national: digits.slice(c.dial.length) };
    }
  }
  return null;
}

export function isValidPhoneE164(e164: string, iso2?: string): boolean {
  const trimmed = e164.trim();
  if (!/^\+[1-9]\d{1,14}$/.test(trimmed)) return false;
  const parsed = parseE164(trimmed);
  if (!parsed) return false;
  const country = iso2 ? getPhoneCountry(iso2) : parsed.country;
  if (parsed.country.iso2 !== country.iso2 && iso2) {
    const digits = trimmed.replace(/\D/g, "");
    if (!digits.startsWith(country.dial)) return false;
    const national = digits.slice(country.dial.length);
    return national.length >= country.minLen && national.length <= country.maxLen;
  }
  const { national } = parsed;
  return national.length >= country.minLen && national.length <= country.maxLen;
}
