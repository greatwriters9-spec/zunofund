"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Crown, Sparkles, TrendingUp } from "lucide-react";

import { DASHBOARD_CARD, DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";
import {
  dailyCompoundLabel,
  displayPlanName,
  formatDepositRangeDescription,
  minPlatformDepositUsd,
  type CanonicalInvestmentPlan,
} from "@/lib/investmentPlans";
import { planDepositRange } from "@/lib/platformConfig/helpers";
import { usePlatformConfig } from "@/lib/platformConfig";
import { formatUsdAmount } from "@/lib/formatMoney";

type DashboardEliteUpgradeAdProps = {
  planKey: CanonicalInvestmentPlan;
  balance: number;
};

const TIER_LADDER: CanonicalInvestmentPlan[] = ["Starter", "Growth", "Pro", "Elite"];

function nextTier(planKey: CanonicalInvestmentPlan): CanonicalInvestmentPlan | null {
  const index = TIER_LADDER.indexOf(planKey);
  if (index < 0 || index >= TIER_LADDER.length - 1) return null;
  return TIER_LADDER[index + 1] ?? null;
}

export function DashboardEliteUpgradeAd({ planKey, balance }: DashboardEliteUpgradeAdProps) {
  const { config } = usePlatformConfig();
  const plans = config.plans;
  const upcoming = nextTier(planKey);
  const eliteMin = planDepositRange(plans, "Elite").min;
  const gapToElite = Math.max(0, eliteMin - balance);
  const minInterest = minPlatformDepositUsd(plans);

  if (planKey === "Elite") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.14 }}
        className={`${DASHBOARD_CARD} relative overflow-hidden p-5 sm:p-6`}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_100%_0%,rgba(212,175,55,0.14)_0%,transparent_60%)]"
          aria-hidden
        />
        <div className="relative flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37]/25">
            <Crown className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]">
              Elite Member
            </p>
            <p className="mt-1 text-sm text-white">
              You&apos;re on our highest tier. Add more capital to maximize daily compounding.
            </p>
            <Link
              href="/deposit"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#D4AF37] hover:text-[#F5E6B3]"
            >
              Add funds
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.aside
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.14 }}
      aria-label="Upgrade to Elite Level"
      className={`${DASHBOARD_CARD} relative overflow-hidden p-5 sm:p-6`}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#D4AF37]/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_0%_0%,rgba(212,175,55,0.12)_0%,transparent_55%)]"
        aria-hidden
      />

      <div className="relative">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#D4AF37]" aria-hidden />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D4AF37]/90">
            Level up your returns
          </p>
        </div>

        <h3 className="mt-3 text-lg font-semibold leading-snug text-white sm:text-xl">
          Unlock{" "}
          <span className="bg-gradient-to-r from-[#F7E3A0] via-[#D4AF37] to-[#F5E6B3] bg-clip-text text-transparent">
            Elite Level
          </span>{" "}
          — up to 50% daily returns
        </h3>

        <p className="mt-2 text-sm leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
          Invest more to climb tiers and access our highest growth structure. Daily interest starts
          at {formatUsdAmount(minInterest)}. Elite members earn{" "}
          {dailyCompoundLabel("Elite", plans).toLowerCase()} with VIP portfolio allocation.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: DASHBOARD_MUTED }}>
              Your tier
            </p>
            <p className="mt-1 text-sm font-semibold text-white">{displayPlanName(planKey)}</p>
            <p className="mt-0.5 text-xs text-[#D4AF37]">{dailyCompoundLabel(planKey, plans)}</p>
          </div>
          <div className="rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-[#D4AF37]/80">
              {upcoming ? "Next unlock" : "Top tier"}
            </p>
            <p className="mt-1 text-sm font-semibold text-[#F5E6B3]">
              {upcoming ? displayPlanName(upcoming) : displayPlanName("Elite")}
            </p>
            <p className="mt-0.5 text-xs text-[#D4AF37]">
              {upcoming ? dailyCompoundLabel(upcoming, plans) : dailyCompoundLabel("Elite", plans)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] px-3 py-2.5">
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden />
          <p className="text-xs leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
            {gapToElite > 0 ? (
              <>
                Deposit{" "}
                <span className="font-semibold text-[#F5E6B3]">{formatUsdAmount(gapToElite)}</span>{" "}
                more to qualify for Elite ({formatDepositRangeDescription("Elite", plans)}).
              </>
            ) : (
              <>
                Your balance qualifies for Elite ({formatDepositRangeDescription("Elite", plans)}). Confirm
                your upgrade on the plans page.
              </>
            )}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/investment-plans"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#F7E3A0] via-[#D4AF37] to-[#EAC54F] px-4 py-2.5 text-xs font-bold text-black shadow-[0_0_20px_rgba(212,175,55,0.2)] transition hover:brightness-105"
          >
            Explore Elite
          </Link>
          <Link
            href="/deposit"
            className="inline-flex items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-white transition hover:border-[#D4AF37]/35"
          >
            Invest more
          </Link>
        </div>
      </div>
    </motion.aside>
  );
}
