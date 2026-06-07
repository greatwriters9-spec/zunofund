"use client";

import { MarketTickerRow } from "@/components/markets/MarketTickerRow";
import { DASHBOARD_CARD } from "@/components/dashboard/premium/dashboardStyles";
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
      <h2 className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
        {title}
      </h2>
      <div className={`${DASHBOARD_CARD} overflow-hidden`}>
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
