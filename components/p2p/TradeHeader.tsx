"use client";

import { Clock, Lock } from "lucide-react";

import { formatHMS, orderStatusHeadline } from "./utils";

type TradeHeaderProps = {
  status: string;
  /** Seconds remaining; 0 hides countdown */
  countdownSeconds: number;
  className?: string;
};

export function TradeHeader({ status, countdownSeconds, className = "" }: TradeHeaderProps) {
  const showTimer = countdownSeconds > 0;

  const startedCopy =
    status === "completed" ? "Trade finished" : status === "cancelled" ? "Trade closed" : "Trade started";
  const showEscrowLock = status === "pending_payment" || status === "paid";

  return (
    <header
      className={`shrink-0 space-y-2 border-b border-white/[0.06] bg-black/[0.12] px-4 py-3 backdrop-blur-sm sm:px-5 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]/85">
            {showEscrowLock ? <Lock className="h-3 w-3 text-[#D4AF37]/80" aria-hidden /> : null}
            {startedCopy}
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
    </header>
  );
}
