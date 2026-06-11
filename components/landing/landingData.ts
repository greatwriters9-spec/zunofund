import { formatPlanDepositRange } from "@/lib/platformConfig/helpers";
import type { InvestmentPlanRow } from "@/lib/platformConfig/types";
import { FALLBACK_PLANS } from "@/lib/platformConfig/fallbacks";
import { normalizeInvestmentPlan } from "@/lib/investmentPlanIdentity";

const LANDING_PLAN_COPY: Record<
  string,
  { description: string; benefits: string[]; button: string }
> = {
  Starter: {
    description:
      "Perfect for investors beginning their portfolio growth journey with manageable capital exposure.",
    benefits: [
      "Beginner-friendly allocation",
      "Stable portfolio growth",
      "Low capital entry",
      "Portfolio monitoring",
    ],
    button: "Start Investing",
  },
  Growth: {
    description:
      "Designed for investors seeking stronger capital expansion and increased earning potential.",
    benefits: [
      "Enhanced growth opportunities",
      "Priority monitoring",
      "Faster scaling",
      "Improved allocations",
    ],
    button: "Upgrade to Growth",
  },
  Pro: {
    description:
      "Built for experienced investors focused on advanced portfolio participation.",
    benefits: [
      "Premium returns structure",
      "Advanced positioning",
      "Priority withdrawals",
      "Accelerated growth",
    ],
    button: "Go Pro",
  },
  Elite: {
    description:
      "Exclusive portfolio management for high-capital investors seeking elite opportunities.",
    benefits: [
      "VIP management",
      "Exclusive allocations",
      "Maximum portfolio access",
      "Highest return potential",
    ],
    button: "Join Elite",
  },
};

export function buildLandingPlans(plans: InvestmentPlanRow[] = FALLBACK_PLANS) {
  const source = plans.length > 0 ? plans : FALLBACK_PLANS;
  return source
    .filter((p) => p.promotion_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((plan) => {
      const key = normalizeInvestmentPlan(plan.name);
      const copy = LANDING_PLAN_COPY[key] ?? LANDING_PLAN_COPY.Starter;
      return {
        name: plan.name,
        range: formatPlanDepositRange(source, key),
        roi: `Up to ${plan.daily_roi}% Daily`,
        description: copy.description,
        benefits: copy.benefits,
        button: copy.button,
      };
    });
}

/** @deprecated Use buildLandingPlans(config.plans) */
export const LANDING_PLANS = buildLandingPlans(FALLBACK_PLANS);

export const PROBLEM_CARDS = [
  {
    title: "High Fees",
    text: "Exchange spreads and hidden markups reduce trader profitability.",
  },
  {
    title: "Limited Payment Methods",
    text: "Many users cannot access their preferred local payment rails.",
  },
  {
    title: "Slow Transactions",
    text: "Legacy flows delay trades and create liquidity friction.",
  },
  {
    title: "Lack of Trusted Merchants",
    text: "Unverified counterparties increase dispute and fraud risk.",
  },
  {
    title: "Regional Restrictions",
    text: "Cross-border users struggle to access deep local markets.",
  },
] as const;

export const VISION_STATS = [
  { value: "2.4M+", label: "Users Worldwide" },
  { value: "150+", label: "Countries Supported" },
  { value: "$150M+", label: "Monthly Volume" },
  { value: "99.8%", label: "Success Rate" },
] as const;

export const HOW_IT_WORKS_STEPS = [
  {
    step: "1",
    title: "Create Account",
    text: "Securely register and gain access to your personalized investor dashboard.",
  },
  {
    step: "2",
    title: "Fund Your Wallet",
    text: "Deposit capital into your account and select your preferred plan.",
  },
  {
    step: "3",
    title: "Buy, Sell or Invest",
    text: "Trade on the P2P marketplace or participate in structured growth plans.",
  },
  {
    step: "4",
    title: "Grow With Zuno",
    text: "Monitor portfolio growth, receive profits, and request secure withdrawals.",
  },
] as const;

export const ROADMAP_PHASES = [
  {
    phase: "Phase 1",
    title: "Launch & Growth Program",
    text: "Build investor and trader momentum, launch secure P2P escrow, and improve execution quality.",
    accent: "border-yellow-400/50 bg-yellow-500/15 text-yellow-300",
    dot: "bg-yellow-400",
  },
  {
    phase: "Phase 2",
    title: "Marketplace Expansion",
    text: "Scale merchant coverage, increase country reach, and support region-specific payment channels.",
    accent: "border-sky-400/50 bg-sky-500/15 text-sky-300",
    dot: "bg-sky-400",
  },
  {
    phase: "Phase 3",
    title: "Global P2P Ecosystem",
    text: "Become the world's trusted global crypto marketplace for direct peer-to-peer finance.",
    accent: "border-violet-400/50 bg-violet-500/15 text-violet-300",
    dot: "bg-violet-400",
  },
] as const;

/** Early-member investment promotion — ends end of day before this date (display only). */
export const EARLY_MEMBER_PROMOTION = {
  endDateLabel: "Jan 1, 2027",
} as const;
