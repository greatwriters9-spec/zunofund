"use client";

import Link from "next/link";
import { useMemo, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";

import { MarketRowSkeleton } from "@/components/markets/MarketRowSkeleton";
import { MarketSection } from "@/components/markets/MarketSection";
import { MarketTickerRow } from "@/components/markets/MarketTickerRow";
import { readMarketFavorites, toggleMarketFavorite } from "@/lib/markets/favorites";
import {
  DEFAULT_MARKET_SYMBOLS,
  topGainers,
  topLosers,
  trendingTickers,
} from "@/lib/markets/symbols";
import { useMarketTickers } from "@/lib/markets/useMarketTickers";
import type { MarketTicker } from "@/lib/markets/types";

function filterTickers(tickers: MarketTicker[], query: string): MarketTicker[] {
  const q = query.trim().toLowerCase();
  if (!q) return tickers;
  return tickers.filter(
    (t) =>
      t.symbol.toLowerCase().includes(q) ||
      t.baseAsset.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.displayPair.toLowerCase().includes(q),
  );
}

export function MarketsView() {
  const symbols = useMemo(() => [...DEFAULT_MARKET_SYMBOLS], []);
  const { tickers, loading, error, stale, refresh } = useMarketTickers(symbols);
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    setFavorites(readMarketFavorites());
  }, []);

  const onToggleFavorite = useCallback((symbol: string) => {
    setFavorites((prev) => toggleMarketFavorite(symbol, prev));
  }, []);

  const filtered = useMemo(() => filterTickers(tickers, search), [tickers, search]);

  const favoriteTickers = useMemo(
    () =>
      favorites
        .map((sym) => tickers.find((t) => t.symbol === sym))
        .filter((t): t is MarketTicker => Boolean(t)),
    [favorites, tickers],
  );

  const trending = useMemo(() => trendingTickers(tickers, 5), [tickers]);
  const gainers = useMemo(() => topGainers(tickers, 5), [tickers]);
  const losers = useMemo(() => topLosers(tickers, 5), [tickers]);

  const showSections = !search.trim();

  return (
    <div className="min-h-screen bg-[#05080F] text-white">
      <div className="mx-auto max-w-3xl lg:max-w-4xl">
        <header className="sticky top-0 z-30 border-b border-zinc-800/90 bg-[#05080F]/95 px-4 py-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-medium text-yellow-500 transition hover:text-yellow-400"
            >
              <ArrowLeft size={16} aria-hidden />
              Markets
            </Link>
            <button
              type="button"
              onClick={() => void refresh()}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 text-zinc-400 transition hover:border-yellow-500/40 hover:text-yellow-500"
              aria-label="Refresh markets"
            >
              <RefreshCw size={16} aria-hidden />
            </button>
          </div>

          <div className="relative mt-4">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search coin or pair"
              className="w-full rounded-xl border border-zinc-800/90 bg-zinc-950/60 py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-yellow-500/40 focus:ring-1 focus:ring-yellow-500/25"
            />
          </div>

          {error && tickers.length === 0 ? (
            <p className="mt-2 text-xs text-amber-400/90">{error}</p>
          ) : stale ? (
            <p className="mt-2 text-xs text-amber-400/90">
              {error ?? "Showing last cached prices — retrying…"}
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-zinc-600">Live · Binance · updates every 5s</p>
          )}
        </header>

        <div className="px-0 pb-8 pt-4 sm:px-2">
          {loading && tickers.length === 0 ? (
            <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/40">
              {Array.from({ length: 6 }).map((_, i) => (
                <MarketRowSkeleton key={i} />
              ))}
            </div>
          ) : null}

          {!loading || tickers.length > 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {showSections && favoriteTickers.length > 0 ? (
                <MarketSection
                  title="Favorites"
                  tickers={favoriteTickers}
                  favorites={favorites}
                  onToggleFavorite={onToggleFavorite}
                />
              ) : null}

              {showSections ? (
                <>
                  <MarketSection
                    title="Trending"
                    tickers={trending}
                    favorites={favorites}
                    onToggleFavorite={onToggleFavorite}
                    compact
                  />
                  <MarketSection
                    title="Top gainers"
                    tickers={gainers}
                    favorites={favorites}
                    onToggleFavorite={onToggleFavorite}
                    compact
                  />
                  <MarketSection
                    title="Top losers"
                    tickers={losers}
                    favorites={favorites}
                    onToggleFavorite={onToggleFavorite}
                    compact
                  />
                </>
              ) : null}

              <section>
                <h2 className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-yellow-500/80">
                  {search.trim() ? "Results" : "All markets"}
                </h2>
                <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/40">
                  {filtered.length > 0 ? (
                    filtered.map((t) => (
                      <MarketTickerRow
                        key={t.symbol}
                        ticker={t}
                        isFavorite={favorites.includes(t.symbol)}
                        onToggleFavorite={onToggleFavorite}
                      />
                    ))
                  ) : (
                    <p className="px-4 py-10 text-center text-sm text-zinc-500">No pairs match your search.</p>
                  )}
                </div>
              </section>
            </motion.div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
