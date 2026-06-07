"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Star } from "lucide-react";

import { MarketCoinIcon } from "@/components/markets/MarketCoinIcon";
import {
  changeColorClass,
  formatChangePercent,
  formatCompactVolume,
  formatMarketPrice,
} from "@/lib/markets/format";
import { symbolToSlug } from "@/lib/markets/symbols";
import type { MarketTicker } from "@/lib/markets/types";

type MarketTickerRowProps = {
  ticker: MarketTicker;
  isFavorite?: boolean;
  onToggleFavorite?: (symbol: string) => void;
  compact?: boolean;
};

export function MarketTickerRow({
  ticker,
  isFavorite,
  onToggleFavorite,
  compact,
}: MarketTickerRowProps) {
  const up = ticker.priceChangePercent >= 0;
  const href = `/markets/${symbolToSlug(ticker.symbol)}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="group border-b border-white/[0.04] last:border-0 transition hover:bg-white/[0.02]"
    >
      <div className="flex items-center gap-2 px-3 py-3 sm:px-4 sm:py-3.5">
        {onToggleFavorite ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onToggleFavorite(ticker.symbol);
            }}
            className="shrink-0 rounded-lg p-1 text-zinc-600 transition hover:text-[#D4AF37]"
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star
              size={16}
              className={isFavorite ? "fill-[#D4AF37] text-[#D4AF37]" : ""}
              aria-hidden
            />
          </button>
        ) : null}

        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
          <MarketCoinIcon baseAsset={ticker.baseAsset} size={compact ? 32 : 36} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{ticker.baseAsset}</span>
              <span className="text-xs" style={{ color: "#8A93A5" }}>
                {ticker.displayPair}
              </span>
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${up ? "bg-emerald-500" : "bg-red-500"}`}
                title={up ? "Positive 24h" : "Negative 24h"}
                aria-hidden
              />
            </div>
            {!compact ? (
              <p className="truncate text-xs" style={{ color: "#8A93A5" }}>
                {ticker.name}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 text-right">
            <p className="font-semibold tabular-nums text-white">
              {formatMarketPrice(ticker.lastPrice)}
            </p>
            <p className={`text-xs font-medium tabular-nums ${changeColorClass(ticker.priceChangePercent)}`}>
              {formatChangePercent(ticker.priceChangePercent)}
            </p>
            {!compact ? (
              <p className="mt-0.5 text-[11px] tabular-nums" style={{ color: "#8A93A5" }}>
                Vol {formatCompactVolume(ticker.quoteVolume24h)}
              </p>
            ) : null}
          </div>
        </Link>
      </div>
    </motion.div>
  );
}
