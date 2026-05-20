"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { P2P_PAYMENT_METHOD_OPTIONS } from "@/lib/p2pPaymentMethods";
import type { P2pMarketTab } from "@/components/p2p/p2pTypes";

export type { P2pMarketTab } from "@/components/p2p/p2pTypes";

type FilterBarProps = {
  tab: P2pMarketTab;
  onTabChange: (t: P2pMarketTab) => void;
  amount: string;
  onAmountChange: (v: string) => void;
  method: string;
  onMethodChange: (v: string) => void;
  onSearch: () => void;
  loading?: boolean;
  footer?: ReactNode;
};

export function FilterBar({
  tab,
  onTabChange,
  amount,
  onAmountChange,
  method,
  onMethodChange,
  onSearch,
  loading,
  footer,
}: FilterBarProps) {
  return (
    <div className="sticky top-0 z-40 border-b border-[#D4AF37]/15 bg-[#05080F]/55 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div className="mx-auto max-w-5xl px-4 pb-3 pt-3 sm:px-5">
        <div
          className="mb-3 flex rounded-xl border border-white/10 bg-black/30 p-1 backdrop-blur-sm"
          role="tablist"
          aria-label="Trade direction"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "buy"}
            onClick={() => onTabChange("buy")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition sm:py-2 ${
              tab === "buy"
                ? "bg-emerald-600 text-white shadow-[0_0_24px_rgba(212,175,55,0.25)] ring-2 ring-[#D4AF37]/45"
                : "text-zinc-400 hover:text-[#F5E6B3]"
            }`}
          >
            Buy USDT
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "sell"}
            onClick={() => onTabChange("sell")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition sm:py-2 ${
              tab === "sell"
                ? "bg-red-600 text-white shadow-[0_0_24px_rgba(239,68,68,0.25)] ring-2 ring-red-400/45"
                : "text-zinc-400 hover:text-[#F5E6B3]"
            }`}
          >
            Sell USDT
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
          <label className="block flex-1 min-w-0">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Amount (USDT)
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="e.g. 500"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-[#D4AF37]/45 focus:ring-2 focus:ring-[#D4AF37]/20 sm:py-2.5"
            />
          </label>

          <label className="block flex-1 min-w-0 sm:max-w-[240px]">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Payment method
            </span>
            <select
              value={method}
              onChange={(e) => onMethodChange(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-[#D4AF37]/45 focus:ring-2 focus:ring-[#D4AF37]/20 sm:py-2.5"
            >
              <option value="">All methods</option>
              {P2P_PAYMENT_METHOD_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={onSearch}
            disabled={loading}
            className={`flex shrink-0 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-[0_0_28px_rgba(212,175,55,0.18)] ring-1 transition disabled:opacity-50 sm:py-2.5 ${
              tab === "sell"
                ? "bg-red-600 shadow-[0_0_28px_rgba(239,68,68,0.18)] ring-red-400/40 hover:bg-red-500"
                : "bg-emerald-600 ring-[#D4AF37]/40 hover:bg-emerald-500"
            }`}
          >
            <Search className="h-4 w-4" aria-hidden />
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        {footer ? <div className="mt-3">{footer}</div> : null}
      </div>
    </div>
  );
}
