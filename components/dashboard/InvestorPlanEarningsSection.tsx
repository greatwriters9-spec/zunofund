"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { DASHBOARD_CARD, DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";
import {
  dailyCompoundLabel,
  displayPlanName,
  formatDepositRangeDescription,
  MIN_INTEREST_QUALIFYING_USD,
  qualifiesForDailyInterest,
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
  const earnsInterest = qualifiesForDailyInterest(balanceUsd);
  const monthly = projectedMonthlyEarningsUsd(balanceUsd, planKey);
  const hidden = "••••••";

  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <div className={`${DASHBOARD_CARD} border-[#D4AF37]/15 bg-[linear-gradient(135deg,rgba(212,175,55,0.06)_0%,rgba(12,17,28,0.85)_55%)] p-5`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
          Current investment plan
        </p>
        <p className="mt-2 text-xl font-semibold text-[#F5E6B3]">{displayPlanName(planKey)}</p>
        <p className="mt-1 text-sm text-[#D4AF37]">{dailyCompoundLabel(planKey)}</p>
        <p className="mt-2 text-xs" style={{ color: DASHBOARD_MUTED }}>
          Qualifying principal range: {formatDepositRangeDescription(planKey)}
        </p>
        <Link
          href="/investment-plans"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#D4AF37] transition hover:text-[#F5E6B3]"
        >
          View all plans
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>

      <div className={`${DASHBOARD_CARD} p-5`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: DASHBOARD_MUTED }}>
          Projected earnings per month
        </p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-[#00C076]">
          {showBalance && earnsInterest
            ? formatUsdAmount(monthly)
            : showBalance
              ? formatUsdAmount(0)
              : hidden}
        </p>
        <p className="mt-2 text-xs leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
          {earnsInterest ? (
            <>
              Estimate uses your current balance ({showBalance ? `$${formatMoneyAmount(balanceUsd)}` : hidden}{" "}
              USDT) and {dailyCompoundLabel(planKey).toLowerCase()}, compounded over 30 days. Actual
              returns vary with deposits, withdrawals, and plan tier.
            </>
          ) : (
            <>
              Balances below {formatUsdAmount(MIN_INTEREST_QUALIFYING_USD)} do not accrue daily interest.
              You can still trade on P2P. Deposit at least{" "}
              {formatUsdAmount(MIN_INTEREST_QUALIFYING_USD)} to start earning.
            </>
          )}
        </p>
      </div>
    </section>
  );
}
