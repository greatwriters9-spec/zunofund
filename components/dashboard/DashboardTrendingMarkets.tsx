"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight } from "lucide-react";

import { MarketRowSkeleton } from "@/components/markets/MarketRowSkeleton";
import { MarketTickerRow } from "@/components/markets/MarketTickerRow";
import { DEFAULT_MARKET_SYMBOLS, trendingTickers } from "@/lib/markets/symbols";
import { useMarketTickers } from "@/lib/markets/useMarketTickers";

export function DashboardTrendingMarkets() {
  const symbols = useMemo(() => [...DEFAULT_MARKET_SYMBOLS], []);
  const { tickers, loading } = useMarketTickers(symbols);
  const trending = useMemo(() => trendingTickers(tickers, 5), [tickers]);

  return (
    <section className="mb-7 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/40 lg:rounded-xl">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 px-4 py-3 sm:px-5">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Trending
        </h2>
        <Link
          href="/markets"
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-yellow-500 transition hover:text-yellow-400"
        >
          Markets
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {loading && trending.length === 0 ? (
        <>
          <MarketRowSkeleton />
          <MarketRowSkeleton />
          <MarketRowSkeleton />
        </>
      ) : null}

      {trending.length > 0
        ? trending.map((t) => <MarketTickerRow key={t.symbol} ticker={t} compact />)
        : null}

      {!loading && trending.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-zinc-500">Market data unavailable.</p>
      ) : null}
    </section>
  );
}
