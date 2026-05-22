/**
 * Catalog of supported fiat currencies for the P2P marketplace and balance
 * displays. All currencies are quoted relative to **USD** (the platform's
 * base accounting unit) — the FX layer in `lib/exchangeRates.ts` provides
 * the live USD→currency rate used to convert amounts at display time.
 *
 * Adding a currency:
 *  1. Append the ISO 4217 code to `FIAT_CURRENCIES` below.
 *  2. The `exchangerate-api` / `exchangerate.host` free endpoints already
 *     cover every entry — no other code change required for FX.
 *  3. UI (`P2pMarketToolbar`, merchant offer form, offer card) reads from
 *     this list automatically.
 */

export type FiatCurrencyCode =
  | "USD"
  | "EUR"
  | "GBP"
  | "JPY"
  | "CNY"
  | "INR"
  | "AED"
  | "CHF"
  | "AUD"
  | "CAD"
  | "KES"
  | "UGX"
  | "TZS"
  | "RWF"
  | "ETB"
  | "NGN"
  | "GHS"
  | "ZAR"
  | "ZMW"
  | "EGP"
  | "MAD"
  | "XOF"
  | "XAF";

export type FiatCurrency = {
  code: FiatCurrencyCode;
  /** Human-readable name used in dropdowns. */
  name: string;
  /** Display symbol; falls back to code when there's no glyph (KES, NGN, etc.). */
  symbol: string;
  /** BCP-47 locale used for `Intl.NumberFormat` so digit grouping matches the region. */
  locale: string;
  /** Decimal places to render — 0 for JPY/UGX/RWF, 2 for most. */
  decimals: number;
  /** Region flag emoji (purely visual; safe to drop on environments without emoji fonts). */
  flag: string;
};

export const FIAT_CURRENCIES: readonly FiatCurrency[] = [
  { code: "USD", name: "US Dollar",         symbol: "$",   locale: "en-US", decimals: 2, flag: "🇺🇸" },
  { code: "EUR", name: "Euro",              symbol: "€",   locale: "de-DE", decimals: 2, flag: "🇪🇺" },
  { code: "GBP", name: "Pound Sterling",    symbol: "£",   locale: "en-GB", decimals: 2, flag: "🇬🇧" },
  { code: "JPY", name: "Japanese Yen",      symbol: "¥",   locale: "ja-JP", decimals: 0, flag: "🇯🇵" },
  { code: "CNY", name: "Chinese Yuan",      symbol: "¥",   locale: "zh-CN", decimals: 2, flag: "🇨🇳" },
  { code: "INR", name: "Indian Rupee",      symbol: "₹",   locale: "en-IN", decimals: 2, flag: "🇮🇳" },
  { code: "AED", name: "UAE Dirham",        symbol: "AED", locale: "en-AE", decimals: 2, flag: "🇦🇪" },
  { code: "CHF", name: "Swiss Franc",       symbol: "Fr",  locale: "de-CH", decimals: 2, flag: "🇨🇭" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$",  locale: "en-AU", decimals: 2, flag: "🇦🇺" },
  { code: "CAD", name: "Canadian Dollar",   symbol: "C$",  locale: "en-CA", decimals: 2, flag: "🇨🇦" },
  { code: "KES", name: "Kenyan Shilling",   symbol: "KSh", locale: "en-KE", decimals: 2, flag: "🇰🇪" },
  { code: "UGX", name: "Ugandan Shilling",  symbol: "USh", locale: "en-UG", decimals: 0, flag: "🇺🇬" },
  { code: "TZS", name: "Tanzanian Shilling",symbol: "TSh", locale: "en-TZ", decimals: 0, flag: "🇹🇿" },
  { code: "RWF", name: "Rwandan Franc",     symbol: "RF",  locale: "en-RW", decimals: 0, flag: "🇷🇼" },
  { code: "ETB", name: "Ethiopian Birr",    symbol: "Br",  locale: "en-ET", decimals: 2, flag: "🇪🇹" },
  { code: "NGN", name: "Nigerian Naira",    symbol: "₦",   locale: "en-NG", decimals: 2, flag: "🇳🇬" },
  { code: "GHS", name: "Ghanaian Cedi",     symbol: "GH₵", locale: "en-GH", decimals: 2, flag: "🇬🇭" },
  { code: "ZAR", name: "South African Rand",symbol: "R",   locale: "en-ZA", decimals: 2, flag: "🇿🇦" },
  { code: "ZMW", name: "Zambian Kwacha",    symbol: "ZK",  locale: "en-ZM", decimals: 2, flag: "🇿🇲" },
  { code: "EGP", name: "Egyptian Pound",    symbol: "E£",  locale: "en-EG", decimals: 2, flag: "🇪🇬" },
  { code: "MAD", name: "Moroccan Dirham",   symbol: "MAD", locale: "en-MA", decimals: 2, flag: "🇲🇦" },
  { code: "XOF", name: "West African CFA",  symbol: "CFA", locale: "fr-SN", decimals: 0, flag: "🌍" },
  { code: "XAF", name: "Central African CFA",symbol: "FCFA",locale: "fr-CM",decimals: 0, flag: "🌍" },
] as const;

const FIAT_CURRENCY_INDEX: Record<string, FiatCurrency> = Object.fromEntries(
  FIAT_CURRENCIES.map((c) => [c.code, c]),
);

export const DEFAULT_FIAT_CURRENCY: FiatCurrencyCode = "USD";

export function isFiatCurrencyCode(value: unknown): value is FiatCurrencyCode {
  return typeof value === "string" && value in FIAT_CURRENCY_INDEX;
}

export function getFiatCurrency(code: string): FiatCurrency {
  return FIAT_CURRENCY_INDEX[code] ?? FIAT_CURRENCY_INDEX[DEFAULT_FIAT_CURRENCY];
}

/**
 * Format a fiat amount for display, e.g. `123456.789, "KES"` → `"KSh 123,457"`.
 * Falls back to a code-prefixed format if `Intl.NumberFormat` doesn't recognise
 * the currency in the runtime ICU build.
 */
export function formatFiat(
  amount: number,
  code: string,
  options: { compact?: boolean; showCode?: boolean } = {},
): string {
  const cur = getFiatCurrency(code);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    const fmt = new Intl.NumberFormat(cur.locale, {
      style: "currency",
      currency: cur.code,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      notation: options.compact ? "compact" : "standard",
    });
    const formatted = fmt.format(safeAmount);
    return options.showCode ? `${formatted} ${cur.code}` : formatted;
  } catch {
    return `${cur.symbol} ${safeAmount.toFixed(2)}${options.showCode ? ` ${cur.code}` : ""}`;
  }
}

/** Cheap label "USD · US Dollar" used in dropdown rows. */
export function fiatCurrencyDropdownLabel(code: string): string {
  const cur = getFiatCurrency(code);
  return `${cur.flag} ${cur.code} · ${cur.name}`;
}
