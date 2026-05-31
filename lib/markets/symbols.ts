import type { MarketTicker } from "@/lib/markets/types";

/** Default watchlist shown on Markets (Binance spot USDT pairs). */
export const DEFAULT_MARKET_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "TRXUSDT",
  "TONUSDT",
  "AVAXUSDT",
] as const;

export type DefaultMarketSymbol = (typeof DEFAULT_MARKET_SYMBOLS)[number];

export const MARKET_ASSET_META: Record<
  string,
  { name: string; base: string }
> = {
  BTC: { name: "Bitcoin", base: "BTC" },
  ETH: { name: "Ethereum", base: "ETH" },
  BNB: { name: "BNB", base: "BNB" },
  SOL: { name: "Solana", base: "SOL" },
  XRP: { name: "XRP", base: "XRP" },
  DOGE: { name: "Dogecoin", base: "DOGE" },
  ADA: { name: "Cardano", base: "ADA" },
  TRX: { name: "TRON", base: "TRX" },
  TON: { name: "Toncoin", base: "TON" },
  AVAX: { name: "Avalanche", base: "AVAX" },
};

export function parseUsdtSymbol(symbol: string): { base: string; quote: string } | null {
  const s = symbol.trim().toUpperCase();
  if (!s.endsWith("USDT")) return null;
  const base = s.slice(0, -4);
  if (!base) return null;
  return { base, quote: "USDT" };
}

export function displayPairFromSymbol(symbol: string): string {
  const p = parseUsdtSymbol(symbol);
  if (!p) return symbol;
  return `${p.base}/${p.quote}`;
}

export function assetName(base: string): string {
  return MARKET_ASSET_META[base]?.name ?? base;
}

export function symbolToSlug(symbol: string): string {
  const p = parseUsdtSymbol(symbol);
  if (!p) return symbol.toLowerCase();
  return `${p.base.toLowerCase()}-${p.quote.toLowerCase()}`;
}

export function slugToSymbol(slug: string): string | null {
  const parts = slug.trim().toLowerCase().split("-");
  if (parts.length !== 2) return null;
  const [base, quote] = parts;
  if (quote !== "usdt") return null;
  return `${base.toUpperCase()}USDT`;
}

export function coinIconUrl(baseAsset: string): string {
  const id = baseAsset.toLowerCase();
  return `https://assets.coincap.io/assets/icons/${id}@2x.png`;
}

export function sortByQuoteVolume(tickers: MarketTicker[]): MarketTicker[] {
  return [...tickers].sort((a, b) => b.quoteVolume24h - a.quoteVolume24h);
}

export function topGainers(tickers: MarketTicker[], limit = 5): MarketTicker[] {
  return [...tickers]
    .sort((a, b) => b.priceChangePercent - a.priceChangePercent)
    .slice(0, limit);
}

export function topLosers(tickers: MarketTicker[], limit = 5): MarketTicker[] {
  return [...tickers]
    .sort((a, b) => a.priceChangePercent - b.priceChangePercent)
    .slice(0, limit);
}

export function trendingTickers(tickers: MarketTicker[], limit = 5): MarketTicker[] {
  return sortByQuoteVolume(tickers).slice(0, limit);
}
