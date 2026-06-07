"use client";

import Link from "next/link";
import { Crown } from "lucide-react";

import {
  dailyCompoundLabel,
  displayPlanName,
  type CanonicalInvestmentPlan,
} from "@/lib/investmentPlans";

type DashboardTierBadgeProps = {
  planKey: CanonicalInvestmentPlan;
  className?: string;
};

export function DashboardTierBadge({ planKey, className = "" }: DashboardTierBadgeProps) {
  return (
    <Link
      href="/investment-plans"
      className={`inline-flex max-w-full items-center gap-2 rounded-full border border-[#D4AF37]/25 bg-gradient-to-r from-[#D4AF37]/12 to-transparent px-3 py-1.5 text-xs transition hover:border-[#D4AF37]/45 hover:from-[#D4AF37]/18 ${className}`}
    >
      <Crown className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden />
      <span className="truncate font-semibold text-[#F5E6B3]">{displayPlanName(planKey)}</span>
      <span className="shrink-0 text-[#8A93A5]" aria-hidden>
        ·
      </span>
      <span className="truncate text-[#8A93A5]">{dailyCompoundLabel(planKey)}</span>
    </Link>
  );
}
