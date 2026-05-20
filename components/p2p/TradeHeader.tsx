"use client";

import { AlertTriangle, Clock } from "lucide-react";

import { formatHMS, orderStatusHeadline } from "./utils";

type TradeHeaderProps = {
  status: string;
  /** Seconds remaining; 0 hides countdown */
  countdownSeconds: number;
  className?: string;
};

export function TradeHeader({ status, countdownSeconds, className = "" }: TradeHeaderProps) {
  const showTimer = countdownSeconds > 0;

  return (
    <header
      className={`shrink-0 space-y-2 border-b border-white/[0.06] bg-black/[0.12] px-4 py-3 backdrop-blur-sm sm:px-5 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]/85">
            Live trade
          </p>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-white sm:text-xl">
            {orderStatusHeadline(status)}
          </h1>
        </div>
        {showTimer ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#D4AF37]/20 bg-black/30 px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden />
            <div>
              <p className="text-[9px] uppercase tracking-wide text-zinc-500">Time left</p>
              <p className="font-mono text-base font-semibold tabular-nums leading-none text-[#F5E6B3]">
                {formatHMS(countdownSeconds)}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2 text-[11px] leading-snug text-amber-100/95">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/90" aria-hidden />
        <p>
          <span className="font-medium text-amber-50/95">Stay in-app.</span> Use only escrow + chat here; ignore new
          account numbers or apps pushed off-platform.
        </p>
      </div>
    </header>
  );
}
