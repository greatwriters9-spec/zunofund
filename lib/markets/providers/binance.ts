import {
  assetName,
  displayPairFromSymbol,
  parseUsdtSymbol,
} from "@/lib/markets/symbols";
import type { MarketDataProvider, MarketTicker } from "@/lib/markets/types";

const BINANCE_TICKER_URL = "https://api.binance.com/api/v3/ticker/24hr";

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

  const res = await fetch(`${BINANCE_TICKER_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Binance API error (${res.status})`);
  }

  const raw = (await res.json()) as BinanceTickerRow[];
  if (!Array.isArray(raw)) {
    throw new Error("Invalid Binance response");
  }

  const out: MarketTicker[] = [];
  for (const row of raw) {
    const t = normalizeRow(row);
    if (t && wanted.has(t.symbol)) out.push(t);
  }

  return out.sort((a, b) => a.baseAsset.localeCompare(b.baseAsset));
}

export const binanceMarketProvider: MarketDataProvider = {
  id: "binance",
  fetchTickers24h: fetchBinanceTickers24h,
};
