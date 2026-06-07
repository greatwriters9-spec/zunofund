"use client";

import { Star } from "lucide-react";

type MerchantReputationStripProps = {
  rating?: number | null;
  completionRate?: number | null;
  totalTrades?: number | null;
  className?: string;
};

function StatDivider() {
  return (
    <span className="shrink-0 px-0.5 text-[10px] font-normal text-zinc-700/90" aria-hidden>
      |
    </span>
  );
}

function formatTradeCount(trades: number): string {
  if (trades >= 10_000) {
    const k = trades / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "")}k`;
  }
  if (trades >= 1000) {
    const k = trades / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return trades.toLocaleString();
}

function formatCompletionRate(completion: number): string {
  const rounded = Math.round(completion * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}%` : `${rounded.toFixed(1)}%`;
}

function isNewMerchant(
  rating: number | null | undefined,
  completionRate: number | null | undefined,
  totalTrades: number | null | undefined,
): boolean {
  const trades = Number(totalTrades);
  const completion = Number(completionRate);
  const ratingVal = Number(rating);

  const noTrades = !Number.isFinite(trades) || trades <= 0;
  const noCompletion = !Number.isFinite(completion) || completion <= 0;
  const noRating = !Number.isFinite(ratingVal) || ratingVal <= 0;

  return noTrades || noCompletion || noRating;
}

const ROW_CLASS =
  "flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0 text-[10px] font-medium leading-[1.1] text-zinc-500 max-md:text-[9px] md:flex-nowrap";

/** Reputation row — established: ★ 4.9 | 99% Completion | 350 Trades; new: ★ N/A | Verified | New Listing */
export function MerchantReputationStrip({
  rating,
  completionRate,
  totalTrades,
  className = "",
}: MerchantReputationStripProps) {
  if (isNewMerchant(rating, completionRate, totalTrades)) {
    return (
      <div className={`${ROW_CLASS} ${className}`} aria-label="New merchant listing">
        <span className="inline-flex shrink-0 items-center gap-0.5">
          <Star className="h-2.5 w-2.5 shrink-0 fill-[#D4AF37] text-[#D4AF37] max-md:h-2 max-md:w-2" aria-hidden />
          <span className="font-semibold tabular-nums text-zinc-300">N/A</span>
        </span>
        <StatDivider />
        <span className="shrink-0 whitespace-nowrap">Verified</span>
        <StatDivider />
        <span className="shrink-0 whitespace-nowrap tabular-nums">New Listing</span>
      </div>
    );
  }

  const ratingVal = Number(rating);
  const completion = Number(completionRate);
  const trades = Number(totalTrades);

  return (
    <div className={`${ROW_CLASS} ${className}`}>
      <span
        className="inline-flex shrink-0 items-center gap-0.5"
        aria-label={`${ratingVal.toFixed(1)} out of 5 stars`}
        title={`${ratingVal.toFixed(1)} / 5`}
      >
        <Star className="h-2.5 w-2.5 shrink-0 fill-[#D4AF37] text-[#D4AF37] max-md:h-2 max-md:w-2" aria-hidden />
        <span className="font-semibold tabular-nums text-zinc-300">{ratingVal.toFixed(1)}</span>
      </span>
      <StatDivider />
      <span className="shrink-0 whitespace-nowrap">
        <span className="font-medium tabular-nums text-zinc-400">{formatCompletionRate(completion)}</span>{" "}
        Completion
      </span>
      <StatDivider />
      <span className="shrink-0 whitespace-nowrap tabular-nums">
        {formatTradeCount(trades)} Trades
      </span>
    </div>
  );
}
