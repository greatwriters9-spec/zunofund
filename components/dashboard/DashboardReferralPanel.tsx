"use client";

import { Copy, Gift } from "lucide-react";

type DashboardReferralPanelProps = {
  referralCode: string;
  referralLink: string;
  copied: boolean;
  onCopy: () => void;
};

export function DashboardReferralPanel({
  referralCode,
  referralLink,
  copied,
  onCopy,
}: DashboardReferralPanelProps) {
  return (
    <div className="mt-4 rounded-xl border border-yellow-500/15 bg-yellow-500/[0.04] px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-yellow-500/90">
            <Gift size={14} aria-hidden />
            5% Network Rewards
          </p>
          <p className="mt-1 text-xs text-zinc-500">Your network moves. You earn 5%.</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:w-[25rem]">
          <div className="flex min-w-0 items-center gap-2 rounded-lg border border-zinc-800 bg-black/35 px-3 py-2">
            <span className="shrink-0 rounded bg-yellow-500/10 px-2 py-1 font-mono text-xs font-bold text-yellow-300">
              {referralCode}
            </span>
            <span className="truncate text-xs text-zinc-500" title={referralLink}>
              {referralLink}
            </span>
            <button
              type="button"
              onClick={onCopy}
              className="ml-auto shrink-0 text-zinc-400 transition hover:text-yellow-400"
              aria-label="Copy referral link"
            >
              <Copy size={15} aria-hidden />
            </button>
          </div>
          {copied ? (
            <p className="text-right text-[11px] text-emerald-400">Referral link copied.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
