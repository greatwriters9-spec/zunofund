import {
  assetName,
  displayPairFromSymbol,
  parseUsdtSymbol,
} from "@/lib/markets/symbols";
import type { MarketDataProvider, MarketTicker } from "@/lib/markets/types";

/** Market-data-only hosts work on serverless (api.binance.com is often geo-blocked on Vercel). */
const BINANCE_TICKER_URLS = [
  "https://data-api.binance.vision/api/v3/ticker/24hr",
  "https://api.binance.com/api/v3/ticker/24hr",
] as const;

type BinanceTickerRow = {
  symbol?: string;
  lastPrice?: string;
  priceChangePercent?: string;
  volume?: string;
  quoteVolume?: string;
  highPrice?: string;
  lowPrice?: string;
};

function num(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeRow(row: BinanceTickerRow): MarketTicker | null {
  const symbol = (row.symbol ?? "").toUpperCase();
  const parsed = parseUsdtSymbol(symbol);
  if (!parsed) return null;

  return {
    symbol,
    baseAsset: parsed.base,
    quoteAsset: parsed.quote,
    displayPair: displayPairFromSymbol(symbol),
    name: assetName(parsed.base),
    lastPrice: num(row.lastPrice),
    priceChangePercent: num(row.priceChangePercent),
    volume24h: num(row.volume),
    quoteVolume24h: num(row.quoteVolume),
    highPrice: num(row.highPrice),
    lowPrice: num(row.lowPrice),
    provider: "binance",
  };
}

export async function fetchBinanceTickers24h(symbols: string[]): Promise<MarketTicker[]> {
  const wanted = new Set(symbols.map((s) => s.toUpperCase()));
  const params = new URLSearchParams({
    symbols: JSON.stringify([...wanted]),
  });

  let lastError: Error | null = null;

  for (const baseUrl of BINANCE_TICKER_URLS) {
    try {
      const res = await fetch(`${baseUrl}?${params.toString()}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        lastError = new Error(`Binance API error (${res.status})`);
        continue;
      }

      const raw = (await res.json()) as BinanceTickerRow[];
      if (!Array.isArray(raw)) {
        lastError = new Error("Invalid Binance response");
        continue;
      }

      const out: MarketTicker[] = [];
      for (const row of raw) {
        const t = normalizeRow(row);
        if (t && wanted.has(t.symbol)) out.push(t);
      }

      return out.sort((a, b) => a.baseAsset.localeCompare(b.baseAsset));
    } catch (e) {
      lastError = e instanceof Error ? e : new Error("Binance request failed");
    }
  }

  throw lastError ?? new Error("Market data unavailable");
}

export const binanceMarketProvider: MarketDataProvider = {
  id: "binance",
  fetchTickers24h: fetchBinanceTickers24h,
};
