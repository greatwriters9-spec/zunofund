"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  dailyCompoundLabel,
  displayPlanName,
  formatDepositRangeDescription,
  type CanonicalInvestmentPlan,
} from "@/lib/investmentPlans";
import { projectedMonthlyEarningsUsd } from "@/lib/investorBalanceMetrics";
import { formatMoneyAmount, formatUsdAmount } from "@/lib/formatMoney";

type InvestorPlanEarningsSectionProps = {
  planKey: CanonicalInvestmentPlan;
  balanceUsd: number;
  showBalance: boolean;
};

export function InvestorPlanEarningsSection({
  planKey,
  balanceUsd,
  showBalance,
}: InvestorPlanEarningsSectionProps) {
  const monthly = projectedMonthlyEarningsUsd(balanceUsd, planKey);
  const hidden = "••••••";

  return (
    <section className="mt-8 space-y-4">
      <div className="rounded-xl border border-yellow-500/15 bg-yellow-500/[0.03] p-5 sm:p-6">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Current investment plan
        </p>
        <p className="mt-2 text-xl font-bold text-yellow-500">{displayPlanName(planKey)}</p>
        <p className="mt-1 text-sm text-zinc-500">{dailyCompoundLabel(planKey)}</p>
        <p className="mt-2 text-xs text-zinc-600">
          Qualifying principal range: {formatDepositRangeDescription(planKey)}
        </p>
        <Link
          href="/investment-plans"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-300 transition hover:text-yellow-400"
        >
          View all plans
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-5 sm:p-6">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Projected earnings per month
        </p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-400">
          {showBalance ? formatUsdAmount(monthly) : hidden}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-600">
          Estimate uses your current balance ({showBalance ? `$${formatMoneyAmount(balanceUsd)}` : hidden}{" "}
          USDT) and {dailyCompoundLabel(planKey).toLowerCase()}, compounded over 30 days. Actual returns
          vary with deposits, withdrawals, and plan tier.
        </p>
      </div>
    </section>
  );
}
