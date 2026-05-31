import { NextResponse } from "next/server";

import { DEFAULT_MARKET_SYMBOLS } from "@/lib/markets/symbols";
import { fetchMarketTickers } from "@/lib/markets/providers/registry";
import type { MarketTickersResponse } from "@/lib/markets/types";

export const dynamic = "force-dynamic";

const CACHE_MS = 2000;
let memoryCache: { key: string; at: number; body: MarketTickersResponse } | null = null;

function parseSymbolsParam(raw: string | null): string[] {
  if (!raw?.trim()) return [...DEFAULT_MARKET_SYMBOLS];
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = parseSymbolsParam(searchParams.get("symbols"));
  const cacheKey = symbols.join(",");

  const now = Date.now();
  if (memoryCache && memoryCache.key === cacheKey && now - memoryCache.at < CACHE_MS) {
    return NextResponse.json(memoryCache.body, {
      headers: {
        "Cache-Control": "public, s-maxage=2, stale-while-revalidate=5",
      },
    });
  }

  try {
    const tickers = await fetchMarketTickers(symbols, "binance");
    const body: MarketTickersResponse = {
      tickers,
      provider: "binance",
      fetchedAt: new Date().toISOString(),
    };
    memoryCache = { key: cacheKey, at: now, body };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=2, stale-while-revalidate=8",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Market data unavailable";
    const staleBody: MarketTickersResponse = {
      tickers: memoryCache?.key === cacheKey ? memoryCache.body.tickers : [],
      provider: "binance",
      fetchedAt: new Date().toISOString(),
      stale: true,
      error: message,
    };

    return NextResponse.json(staleBody, {
      status: 200,
      headers: { "Cache-Control": "public, s-maxage=2" },
    });
  }
}
