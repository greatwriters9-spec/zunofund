import { fetchBinanceTickers24h, binanceMarketProvider } from "@/lib/markets/providers/binance";
import type { MarketDataProvider, MarketProviderId, MarketTicker } from "@/lib/markets/types";

const providers: Record<MarketProviderId, MarketDataProvider> = {
  binance: binanceMarketProvider,
};

export const DEFAULT_MARKET_PROVIDER: MarketProviderId = "binance";

export function getMarketProvider(id: MarketProviderId = DEFAULT_MARKET_PROVIDER): MarketDataProvider {
  return providers[id];
}

/** Server-side fetch via registered provider (extend with coingecko, bybit, etc.). */
export async function fetchMarketTickers(
  symbols: string[],
  providerId: MarketProviderId = DEFAULT_MARKET_PROVIDER,
): Promise<MarketTicker[]> {
  const provider = getMarketProvider(providerId);
  return provider.fetchTickers24h(symbols);
}

export { fetchBinanceTickers24h };
