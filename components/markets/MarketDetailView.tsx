"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Star } from "lucide-react";

import { MarketCoinIcon } from "@/components/markets/MarketCoinIcon";
import {
  CHART_INTERVAL_OPTIONS,
  TradingViewChart,
  type ChartInterval,
} from "@/components/markets/TradingViewChart";
import { readMarketFavorites, toggleMarketFavorite } from "@/lib/markets/favorites";
import {
  changeColorClass,
  formatChangePercent,
  formatCompactVolume,
  formatMarketPrice,
} from "@/lib/markets/format";
import { useMarketTickers } from "@/lib/markets/useMarketTickers";
type MarketDetailViewProps = {
  symbol: string;
};

export function MarketDetailView({ symbol }: MarketDetailViewProps) {
  const symbols = useMemo(() => [symbol], [symbol]);
  const { tickers, loading, error, stale } = useMarketTickers(symbols);
  const ticker = tickers[0] ?? null;
  const [chartInterval, setChartInterval] = useState<ChartInterval>("60");
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    setFavorites(readMarketFavorites());
  }, []);

  const isFavorite = favorites.includes(symbol.toUpperCase());

  return (
    <div className="min-h-screen bg-[#05080F] text-white">
      <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 sm:py-6">
        <Link
          href="/markets"
          className="inline-flex items-center gap-2 text-sm font-medium text-yellow-500 transition hover:text-yellow-400"
        >
          <ArrowLeft size={16} aria-hidden />
          Markets
        </Link>

        {loading && !ticker ? (
          <div className="mt-8 animate-pulse space-y-4">
            <div className="h-10 w-48 rounded bg-zinc-800/80" />
            <div className="h-8 w-32 rounded bg-zinc-800/60" />
            <div className="h-[320px] rounded-xl bg-zinc-900/40" />
          </div>
        ) : null}

        {ticker ? (
          <>
            <div className="mt-6 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <MarketCoinIcon baseAsset={ticker.baseAsset} size={48} />
                <div>
                  <h1 className="text-2xl font-bold text-white">{ticker.name}</h1>
                  <p className="text-sm text-zinc-500">{ticker.displayPair}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFavorites((prev) => toggleMarketFavorite(symbol, prev))}
                className="rounded-xl border border-zinc-800 p-2.5 text-zinc-500 transition hover:border-yellow-500/40 hover:text-yellow-500"
                aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
              >
                <Star
                  size={20}
                  className={isFavorite ? "fill-yellow-500 text-yellow-500" : ""}
                  aria-hidden
                />
              </button>
            </div>

            <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight text-white sm:text-4xl">
              {formatMarketPrice(ticker.lastPrice)}
            </p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${changeColorClass(ticker.priceChangePercent)}`}>
              {formatChangePercent(ticker.priceChangePercent)}{" "}
              <span className="text-sm font-normal text-zinc-500">24h</span>
            </p>

            {error && !ticker ? (
              <p className="mt-2 text-xs text-amber-400/90">{error}</p>
            ) : stale ? (
              <p className="mt-2 text-xs text-amber-400/90">
                {error ?? "Cached price — refreshing…"}
              </p>
            ) : null}

            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "24h volume", value: formatCompactVolume(ticker.quoteVolume24h) },
                { label: "24h high", value: formatMarketPrice(ticker.highPrice) },
                { label: "24h low", value: formatMarketPrice(ticker.lowPrice) },
                { label: "Pair", value: ticker.displayPair },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-3 py-3"
                >
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums text-zinc-200">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex flex-wrap gap-2">
              {CHART_INTERVAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChartInterval(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    chartInterval === opt.value
                      ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40"
                      : "border border-zinc-800 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <TradingViewChart symbol={ticker.symbol} interval={chartInterval} />
            </div>
          </>
        ) : null}

        {!loading && !ticker ? (
          <div className="mt-12 text-center">
            <p className="text-zinc-400">Market not found.</p>
            <Link href="/markets" className="mt-4 inline-block text-yellow-500 hover:underline">
              Back to markets
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
