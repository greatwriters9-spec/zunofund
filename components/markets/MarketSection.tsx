"use client";

import { MarketTickerRow } from "@/components/markets/MarketTickerRow";
import type { MarketTicker } from "@/lib/markets/types";

type MarketSectionProps = {
  title: string;
  tickers: MarketTicker[];
  favorites: string[];
  onToggleFavorite: (symbol: string) => void;
  compact?: boolean;
};

export function MarketSection({
  title,
  tickers,
  favorites,
  onToggleFavorite,
  compact,
}: MarketSectionProps) {
  if (tickers.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-yellow-500/80">
        {title}
      </h2>
      <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/40">
        {tickers.map((t) => (
          <MarketTickerRow
            key={t.symbol}
            ticker={t}
            isFavorite={favorites.includes(t.symbol)}
            onToggleFavorite={onToggleFavorite}
            compact={compact}
          />
        ))}
      </div>
    </section>
  );
}
