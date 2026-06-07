"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { DASHBOARD_CARD, DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";
import {
  dailyCompoundLabel,
  displayPlanName,
  type CanonicalInvestmentPlan,
} from "@/lib/investmentPlans";
import { formatMoneyAmount } from "@/lib/formatMoney";

type DashboardActivePlanCardProps = {
  showBalance: boolean;
  planKey: CanonicalInvestmentPlan;
  balance: number;
  totalProfit: number;
  accountStatus: string;
};

function payoutProgressPercent(): number {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const elapsed = now.getTime() - start.getTime();
  return Math.min(100, Math.max(0, (elapsed / 86_400_000) * 100));
}

function payoutCountdownLabel(): string {
  const now = new Date();
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  const ms = Math.max(0, end.getTime() - now.getTime());
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

export function DashboardActivePlanCard({
  showBalance,
  planKey,
  balance,
  totalProfit,
  accountStatus,
}: DashboardActivePlanCardProps) {
  const hidden = "••••••";
  const progress = payoutProgressPercent();
  const isActive = accountStatus.toLowerCase() === "active";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.12 }}
      className={`${DASHBOARD_CARD} relative overflow-hidden p-5 sm:p-6`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgba(212,175,55,0.12)_0%,transparent_55%)]"
        aria-hidden
      />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium" style={{ color: DASHBOARD_MUTED }}>
            Active Investment Plan
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">{displayPlanName(planKey)}</h2>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            isActive
              ? "border-[#00C076]/30 bg-[#00C076]/10 text-[#00C076]"
              : "border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37]"
          }`}
        >
          {isActive ? "Active" : accountStatus}
        </span>
      </div>

      <dl className="relative mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-[11px]" style={{ color: DASHBOARD_MUTED }}>
            Capital
          </dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-white">
            {showBalance ? formatMoneyAmount(balance) : hidden}
          </dd>
        </div>
        <div>
          <dt className="text-[11px]" style={{ color: DASHBOARD_MUTED }}>
            Daily ROI
          </dt>
          <dd className="mt-1 text-sm font-semibold text-[#D4AF37]">
            {dailyCompoundLabel(planKey)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px]" style={{ color: DASHBOARD_MUTED }}>
            Total Profit
          </dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-[#00C076]">
            {showBalance ? formatMoneyAmount(totalProfit) : hidden}
          </dd>
        </div>
        <div>
          <dt className="text-[11px]" style={{ color: DASHBOARD_MUTED }}>
            Next Payout
          </dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-white">
            {payoutCountdownLabel()}
          </dd>
        </div>
      </dl>

      <div className="relative mt-6">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span style={{ color: DASHBOARD_MUTED }}>Progress to Next Payout</span>
          <span className="font-medium text-[#F5E6B3]">{progress.toFixed(0)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#B8860B] via-[#D4AF37] to-[#F5E6B3] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <Link
        href="/investment-plans"
        className="relative mt-5 inline-flex text-xs font-medium text-[#D4AF37] hover:text-[#F5E6B3]"
      >
        View plan details →
      </Link>
    </motion.div>
  );
}
