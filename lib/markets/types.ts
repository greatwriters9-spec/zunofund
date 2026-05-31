/** Normalized ticker — exchange-agnostic for UI and future providers. */
export type MarketTicker = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  displayPair: string;
  name: string;
  lastPrice: number;
  priceChangePercent: number;
  volume24h: number;
  quoteVolume24h: number;
  highPrice: number;
  lowPrice: number;
  provider: string;
};

export type MarketTickersResponse = {
  tickers: MarketTicker[];
  provider: string;
  fetchedAt: string;
  stale?: boolean;
  error?: string;
};

export type MarketProviderId = "binance";

export interface MarketDataProvider {
  id: MarketProviderId;
  fetchTickers24h(symbols: string[]): Promise<MarketTicker[]>;
}
