"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import type { DerivedTradePanels } from "@/components/p2p/deriveTradePanels";

type TradeOrderBriefProps = {
  panels: DerivedTradePanels;
  orderSide: string;
  investorPayoutInstructions?: string | null;
  isMerchant: boolean;
};

export function TradeOrderBrief({
  panels,
  orderSide,
  investorPayoutInstructions,
  isMerchant,
}: TradeOrderBriefProps) {
  const [remindersOpen, setRemindersOpen] = useState(true);
  // On phones the brief eats the chat real estate — collapse the long blocks
  // (system message, reminders, payout mandate) behind a single toggle so the
  // banner + chat are immediately visible. Desktop keeps the full panel.
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setDetailsOpen(true);
    }
  }, []);
  const payout = (investorPayoutInstructions ?? "").trim();

  return (
    <div className="space-y-3 px-4 py-3 sm:px-6 sm:py-4">
      <div className="rounded-md border border-emerald-500/30 bg-emerald-600/90 px-3 py-2 text-[12.5px] font-medium leading-snug text-white shadow-[0_0_0_1px_rgba(212,175,55,0.18)] sm:px-4 sm:py-2.5 sm:text-[13px]">
        <div className="flex flex-col gap-y-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
          <span className="font-semibold uppercase tracking-wide text-[#F5E6B3]">{panels.bannerAccent}</span>
          <span className="hidden text-emerald-100/70 sm:inline">·</span>
          <span>{panels.bannerText}</span>
          <span className="hidden text-emerald-100/70 sm:inline">·</span>
          <span className="text-emerald-50/90">{panels.tradeLine}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setDetailsOpen((s) => !s)}
        className="flex w-full items-center justify-between rounded-md border border-[#D4AF37]/18 bg-black/40 px-4 py-2.5 text-left text-[12.5px] font-semibold text-[#F5E6B3] lg:hidden"
        aria-expanded={detailsOpen}
      >
        {detailsOpen ? "Hide trade details" : "View trade details"}
        <ChevronDown
          className={`h-4 w-4 text-[#D4AF37]/70 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      <div className={`${detailsOpen ? "space-y-3" : "hidden"} lg:block lg:space-y-3`}>
        <div className="rounded-md border border-[#D4AF37]/15 bg-black/40 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#D4AF37]/85">System message</p>
          <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">
            {panels.summaryMarkdown}
          </p>
        </div>

        <div className="rounded-md border border-[#D4AF37]/18 bg-black/40">
          <button
            type="button"
            onClick={() => setRemindersOpen((s) => !s)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] font-semibold text-[#F5E6B3]"
            aria-expanded={remindersOpen}
          >
            Reminders from Zuno
            <ChevronDown
              className={`h-4 w-4 text-[#D4AF37]/70 transition-transform ${remindersOpen ? "" : "-rotate-90"}`}
              aria-hidden
            />
          </button>
          {remindersOpen ? (
            <ul className="space-y-1.5 border-t border-[#D4AF37]/12 px-4 py-3 text-[12.5px] leading-relaxed text-zinc-300">
              <li>
                <span className="font-semibold text-white">Trade responsibly.</span> Stay inside this escrow + chat pairing.
                Off-platform switches are risky and may not be recoverable.
              </li>
              <li>Keep all communication and proof of payment within this thread.</li>
              <li>Confirm cleared funds before releasing crypto.</li>
            </ul>
          ) : null}
        </div>

        <div className="rounded-md border border-[#D4AF37]/15 bg-black/40 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#D4AF37]/85">
            {orderSide === "sell_usdt" ? "Merchant payment instructions" : "Payout mandate"}
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">
            {panels.instructionMarkdown}
          </p>
        </div>

        {orderSide === "buy_usdt" ? (
          <div className="rounded-md border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
              {isMerchant ? "Investor payout (fiat)" : "Your payout lane"}
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-200">
              {payout || (isMerchant ? "—" : "Send bank / wallet / mobile-money details in chat below.")}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
