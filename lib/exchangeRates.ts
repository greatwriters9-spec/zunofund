/**
 * Exchange rate primitives — shared between client and server.
 *
 * The `exchange_rates` table stores a single number per code:
 *   `usd_value` = USD value of one unit of `code`.
 *   USD = 1 (baseline), USDT = 1 (peg), KES ≈ 0.00775, BTC ≈ 70000.
 *
 * Conversions are symmetric:
 *   usd_amount    = native_amount * usd_value(code)
 *   native_amount = usd_amount / usd_value(code)
 */

import { isFiatCurrencyCode } from "@/lib/currencies";

export type FxRateMap = Record<string, number>;

/**
 * Codes the cron route refreshes from CoinGecko (USDT/BTC → USD).
 * Add any new on-platform asset to this list.
 */
export const FX_CRYPTO_CODES = ["USDT", "BTC"] as const;
export type FxCryptoCode = (typeof FX_CRYPTO_CODES)[number];

/**
 * CoinGecko ids for the cryptos above. The free `simple/price` endpoint
 * accepts these comma-separated.
 */
export const FX_CRYPTO_COINGECKO_IDS: Record<FxCryptoCode, string> = {
  USDT: "tether",
  BTC: "bitcoin",
};

/**
 * Fiat codes the cron refreshes from open.er-api.com. Mirrors
 * `lib/currencies.ts::FIAT_CURRENCIES` minus USD (which is the base).
 */
export const FX_FIAT_CODES: readonly string[] = [
  "EUR", "GBP", "JPY", "CNY", "INR", "AED", "CHF", "AUD", "CAD",
  "KES", "UGX", "TZS", "RWF", "ETB", "NGN", "GHS", "ZAR", "ZMW",
  "EGP", "MAD", "XOF", "XAF",
];

/** Cron / API: refresh anything whose `fetched_at` is older than this. */
export const FX_STALE_AFTER_MS = 10 * 60 * 1000; // 10 minutes

// ---------------------------------------------------------------------------
// Math helpers — pure functions, safe to import on client and server
// ---------------------------------------------------------------------------

/**
 * Convert a native amount of `code` to USD using the rate map.
 * Falls back to 1:1 (treats the amount as already-USD) when the code
 * is unknown or the rate is missing — never throws.
 */
export function toUsd(amount: number, code: string, rates: FxRateMap): number {
  if (!Number.isFinite(amount)) return 0;
  const upper = code.toUpperCase();
  if (upper === "USD") return amount;
  const v = rates[upper];
  if (!v || !Number.isFinite(v) || v <= 0) return amount;
  return amount * v;
}

/**
 * Convert a USD amount to the target `code` using the rate map.
 * Falls back to the input USD amount when the code is unknown.
 */
export function fromUsd(usdAmount: number, code: string, rates: FxRateMap): number {
  if (!Number.isFinite(usdAmount)) return 0;
  const upper = code.toUpperCase();
  if (upper === "USD") return usdAmount;
  const v = rates[upper];
  if (!v || !Number.isFinite(v) || v <= 0) return usdAmount;
  return usdAmount / v;
}

/** Convert a USDT amount to a fiat currency. USDT pegs to USD so this just delegates. */
export function usdtToFiat(usdtAmount: number, fiatCode: string, rates: FxRateMap): number {
  return fromUsd(usdtAmount, fiatCode, rates);
}

/** Convert a fiat amount to USDT (for sell-side conversions). */
export function fiatToUsdt(fiatAmount: number, fiatCode: string, rates: FxRateMap): number {
  return toUsd(fiatAmount, fiatCode, rates);
}

// ---------------------------------------------------------------------------
// Server-side rate fetcher (used by the cron route)
// ---------------------------------------------------------------------------

export type RateRow = {
  code: string;
  usd_value: number;
  source: string;
};

/**
 * Fetch crypto rates from CoinGecko. Returns an array of RateRow.
 * Throws on non-2xx; the caller decides how to handle.
 */
export async function fetchCryptoRates(): Promise<RateRow[]> {
  const ids = Object.values(FX_CRYPTO_COINGECKO_IDS).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;

  const resp = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!resp.ok) {
    throw new Error(`CoinGecko ${resp.status}: ${await resp.text().catch(() => "")}`);
  }
  const data = (await resp.json()) as Record<string, { usd?: number }>;

  const rows: RateRow[] = [];
  for (const [code, geckoId] of Object.entries(FX_CRYPTO_COINGECKO_IDS)) {
    const usd = data[geckoId]?.usd;
    if (typeof usd === "number" && Number.isFinite(usd) && usd > 0) {
      rows.push({ code, usd_value: usd, source: "coingecko" });
    }
  }
  return rows;
}

/**
 * Fetch fiat rates from open.er-api.com (free, no key required).
 * The endpoint returns `1 USD = N FIAT`, so we invert to USD/unit.
 */
export async function fetchFiatRates(): Promise<RateRow[]> {
  const resp = await fetch("https://open.er-api.com/v6/latest/USD", {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!resp.ok) {
    throw new Error(`open.er-api ${resp.status}: ${await resp.text().catch(() => "")}`);
  }
  const data = (await resp.json()) as { result?: string; rates?: Record<string, number> };
  if (data.result !== "success" || !data.rates) {
    throw new Error("open.er-api returned no rates");
  }

  const rows: RateRow[] = [];
  for (const code of FX_FIAT_CODES) {
    const r = data.rates[code];
    if (typeof r === "number" && Number.isFinite(r) && r > 0) {
      // r is FIAT per 1 USD; we store USD per 1 FIAT.
      rows.push({ code, usd_value: 1 / r, source: "open-er-api" });
    }
  }
  return rows;
}

/**
 * Combine `RateRow[]` lists from upstream APIs and ensure USD/USDT
 * baselines are present even if upstreams fail.
 */
export function withBaselines(rows: RateRow[]): RateRow[] {
  const have = new Set(rows.map((r) => r.code));
  const out = [...rows];
  if (!have.has("USD")) out.push({ code: "USD", usd_value: 1, source: "baseline" });
  if (!have.has("USDT")) out.push({ code: "USDT", usd_value: 1, source: "baseline" });
  return out;
}

// ---------------------------------------------------------------------------
// Convenience: filter to known display currencies for safe rendering
// ---------------------------------------------------------------------------

/** Pull a fiat code's rate, or 1 if missing — never undefined. */
export function fiatRate(code: string, rates: FxRateMap): number {
  const upper = code.toUpperCase();
  if (!isFiatCurrencyCode(upper)) return 1;
  const v = rates[upper];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 1;
}
