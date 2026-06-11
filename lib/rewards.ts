import {
  CANONICAL_INVESTMENT_PLANS,
  displayPlanName,
  normalizeInvestmentPlan,
  tierRank,
  type CanonicalInvestmentPlan,
} from "@/lib/investmentPlans";
import { FALLBACK_PLANS } from "@/lib/platformConfig/fallbacks";
import { tierThresholdUsd } from "@/lib/platformConfig/helpers";
import type { InvestmentPlanRow } from "@/lib/platformConfig/types";

export type LoyaltyTierSlug = "bronze" | "silver" | "gold" | "platinum" | "elite";

export type RewardHistoryRow = {
  id: string;
  reward_key: string;
  reward_type: string;
  amount: number;
  badge_key: string | null;
  status: string;
  description: string | null;
  granted_at: string;
};

export type PendingRewardRow = {
  id: string;
  reward_key: string;
  reward_type: string;
  amount: number;
  badge_key: string | null;
  description: string | null;
  eligible_at: string;
};

export type InvestorRewardsDashboard = {
  program_enabled: boolean;
  require_admin_activation?: boolean;
  loyalty_tier: LoyaltyTierSlug;
  investment_plan: string;
  portfolio_usd: number;
  total_deposits_usd: number;
  active_referrals: number;
  holding_days: number;
  holding_days_required: number;
  merchant_eligible: boolean;
  merchant_status: string | null;
  claimed_reward_keys: string[];
  pending_reward_keys: string[];
  pending_rewards: PendingRewardRow[];
  history: RewardHistoryRow[];
};

export const LOYALTY_TIER_ORDER: LoyaltyTierSlug[] = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "elite",
];

export const LOYALTY_TIER_LABEL: Record<LoyaltyTierSlug, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  elite: "Elite",
};

export function normalizeLoyaltyTier(raw: string | null | undefined): LoyaltyTierSlug {
  const s = (raw ?? "").toLowerCase();
  if (LOYALTY_TIER_ORDER.includes(s as LoyaltyTierSlug)) return s as LoyaltyTierSlug;
  return "bronze";
}

export function rewardTypeLabel(type: string): string {
  const map: Record<string, string> = {
    holding_bonus: "Holding Bonus",
    tier_upgrade: "Tier Upgrade Reward",
    portfolio_milestone: "Portfolio Milestone",
    referral_milestone: "Referral Reward",
    reinvestment_bonus: "Reinvestment Bonus",
    manual_grant: "Manual Reward",
  };
  return map[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function badgeLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  const map: Record<string, string> = {
    vip_investor: "VIP Investor",
    account_manager: "Dedicated Account Manager",
    vip_referral: "VIP Referral",
    partner_status: "Partner Status",
  };
  return map[key] ?? key.replace(/_/g, " ");
}

export type RewardCardDef = {
  key: string;
  title: string;
  description: string;
  category: "holding" | "tier" | "portfolio" | "referral" | "reinvestment" | "elite";
  amountUsd?: number;
  badge?: string;
  progress?: { current: number; target: number; label: string };
};

export function buildRewardCatalog(data: InvestorRewardsDashboard): {
  activated: RewardCardDef[];
  eligiblePending: RewardCardDef[];
  active: RewardCardDef[];
  upcoming: RewardCardDef[];
} {
  const claimed = new Set(Array.isArray(data.claimed_reward_keys) ? data.claimed_reward_keys : []);
  const pending = new Set(Array.isArray(data.pending_reward_keys) ? data.pending_reward_keys : []);
  const plan = normalizeInvestmentPlan(data.investment_plan);
  const planR = tierRank(plan);

  const all: RewardCardDef[] = [
    {
      key: "holding_30_days",
      title: "30-Day Holding Bonus",
      description: "$100 bonus for maintaining an active balance for 30 consecutive days.",
      category: "holding",
      amountUsd: 100,
      progress: {
        current: data.holding_days,
        target: data.holding_days_required,
        label: `Days Held: ${data.holding_days} / ${data.holding_days_required}`,
      },
    },
    {
      key: "tier_growth_pro",
      title: "Growth → Pro Upgrade",
      description: "$100 reward when your investment tier advances from Growth to Pro.",
      category: "tier",
      amountUsd: 100,
    },
    {
      key: "tier_pro_elite",
      title: "Pro → Elite Upgrade",
      description: "$250 reward when you reach Elite investment tier.",
      category: "tier",
      amountUsd: 250,
    },
    {
      key: "portfolio_5000",
      title: "$5,000 Portfolio",
      description: "VIP Investor badge at $5,000 portfolio value.",
      category: "portfolio",
      badge: "VIP Investor",
    },
    {
      key: "portfolio_10000",
      title: "$10,000 Portfolio",
      description: "$250 cash bonus at $10,000 portfolio value.",
      category: "portfolio",
      amountUsd: 250,
    },
    {
      key: "portfolio_25000",
      title: "$25,000 Portfolio",
      description: "$500 cash bonus at $25,000 portfolio value.",
      category: "portfolio",
      amountUsd: 500,
    },
    {
      key: "portfolio_50000",
      title: "$50,000 Portfolio",
      description: "Dedicated Account Manager badge.",
      category: "portfolio",
      badge: "Dedicated Account Manager",
    },
    {
      key: "referral_10",
      title: "10 Active Referrals",
      description: "$50 bonus when 10 referred investors deposit and stay active.",
      category: "referral",
      amountUsd: 50,
      progress: { current: data.active_referrals, target: 10, label: `${data.active_referrals} / 10 active` },
    },
    {
      key: "referral_25",
      title: "25 Active Referrals",
      description: "$150 bonus at 25 active referrals.",
      category: "referral",
      amountUsd: 150,
      progress: { current: data.active_referrals, target: 25, label: `${data.active_referrals} / 25 active` },
    },
    {
      key: "referral_50",
      title: "50 Active Referrals",
      description: "VIP Referral badge.",
      category: "referral",
      badge: "VIP Referral",
      progress: { current: data.active_referrals, target: 50, label: `${data.active_referrals} / 50 active` },
    },
    {
      key: "referral_100",
      title: "100 Active Referrals",
      description: "Partner Status badge.",
      category: "referral",
      badge: "Partner Status",
      progress: { current: data.active_referrals, target: 100, label: `${data.active_referrals} / 100 active` },
    },
  ];

  const activated = all.filter((r) => claimed.has(r.key));
  const eligiblePending = all.filter((r) => pending.has(r.key) && !claimed.has(r.key));
  const remaining = all.filter((r) => !claimed.has(r.key) && !pending.has(r.key));
  const active = remaining.filter((r) => {
    if (r.key === "tier_growth_pro") return planR >= 1 && planR < 2;
    if (r.key === "tier_pro_elite") return planR >= 2 && planR < 3;
    if (r.progress) return r.progress.current > 0 && r.progress.current < r.progress.target;
    return false;
  });

  return {
    activated,
    eligiblePending,
    active,
    upcoming: remaining.filter((r) => !active.includes(r)),
  };
}

export function nextInvestmentTier(plan: CanonicalInvestmentPlan): CanonicalInvestmentPlan | null {
  const idx = CANONICAL_INVESTMENT_PLANS.indexOf(plan);
  if (idx < 0 || idx >= CANONICAL_INVESTMENT_PLANS.length - 1) return null;
  return CANONICAL_INVESTMENT_PLANS[idx + 1];
}

export function tierProgressPercent(
  plan: CanonicalInvestmentPlan,
  portfolioUsd: number,
  plans?: InvestmentPlanRow[] | null,
): number {
  const source = plans?.length ? plans : FALLBACK_PLANS;
  const next = nextInvestmentTier(plan);
  if (!next) return 100;
  const cur = tierThresholdUsd(source, plan);
  const nxt = tierThresholdUsd(source, next);
  const span = nxt - cur;
  if (span <= 0) return 0;
  return Math.min(100, Math.max(0, ((portfolioUsd - cur) / span) * 100));
}

export function tierProgressLabel(plan: CanonicalInvestmentPlan): string {
  const next = nextInvestmentTier(plan);
  if (!next) return `You are at ${displayPlanName(plan)} — top investment tier`;
  return `Progress toward ${displayPlanName(next)}`;
}
