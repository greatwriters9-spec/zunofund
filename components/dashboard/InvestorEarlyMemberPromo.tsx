"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { EARLY_MEMBER_PROMOTION } from "@/components/landing/landingData";

function PromoDeadlineDateLoud() {
  return (
    <span className="font-black uppercase tracking-wide text-yellow-300 drop-shadow-[0_0_14px_rgba(250,204,21,0.45)]">
      {EARLY_MEMBER_PROMOTION.endDateLabel}
    </span>
  );
}

type InvestorEarlyMemberPromoProps = {
  className?: string;
};

export function InvestorEarlyMemberPromo({ className = "" }: InvestorEarlyMemberPromoProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`max-w-lg border-l border-amber-500/35 pl-3.5 ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="w-full rounded-lg text-left outline-none transition hover:bg-white/[0.02] focus-visible:ring-2 focus-visible:ring-amber-500/40 -ml-1 pl-1 pr-2 py-1"
        aria-expanded={expanded}
        aria-label={
          expanded
            ? "Collapse ZunoFund investment program details"
            : "Expand ZunoFund investment program details"
        }
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium leading-snug text-zinc-300">
            ⚡ ZunoFund Investment Program — Ends <PromoDeadlineDateLoud />
          </p>
          <ChevronDown
            className={`mt-0.5 h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </div>

        <div className="relative mt-2">
          <div
            className={`space-y-3 text-sm leading-relaxed text-zinc-500 transition-opacity duration-200 ${
              expanded ? "opacity-100" : "line-clamp-3 opacity-55"
            }`}
          >
            <p>
              Our investment opportunities are part of a limited promotional program designed to reward early
              members and support the growth of the Zuno ecosystem during its launch phase. Members who join
              before{" "}
              <span className="font-medium text-amber-400/90">{EARLY_MEMBER_PROMOTION.endDateLabel}</span> can
              participate in these exclusive growth plans and enjoy promotional earning benefits.
            </p>
            <p>
              After {EARLY_MEMBER_PROMOTION.endDateLabel}, Zuno will transition to a fully P2P marketplace
              focused exclusively on peer-to-peer trading and merchant services. No new investment plans will be
              offered after this date.
            </p>
          </div>
          {!expanded ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-[#05080F] via-[#05080F]/80 to-transparent"
            />
          ) : null}
        </div>

        <p className="mt-2 text-[11px] font-medium text-zinc-600">
          {expanded ? "Tap to hide details" : "Tap to read full message"}
        </p>
      </button>
    </div>
  );
}
