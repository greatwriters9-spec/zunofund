/** Canonical tiers — must align with Postgres `daily_compound_percent_for_plan` matching order (elite→growth→pro→starter). */
export const CANONICAL_INVESTMENT_PLANS = [
  "Starter",
  "Growth",
  "Pro",
  "Elite",
] as const;

export type CanonicalInvestmentPlan =
  (typeof CANONICAL_INVESTMENT_PLANS)[number];

const ORDER: Record<CanonicalInvestmentPlan, number> = {
  Starter: 0,
  Growth: 1,
  Pro: 2,
  Elite: 3,
};

/** Map free-text DB values ("Starter Level", legacy "starter", etc.) to a canonical slug. */
export function normalizeInvestmentPlan(
  raw: string | null | undefined,
): CanonicalInvestmentPlan {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("elite")) return "Elite";
  if (s.includes("growth")) return "Growth";
  if (s.includes("pro")) return "Pro";
  if (s.includes("starter")) return "Starter";
  return "Starter";
}

/** Human label for dashboards (matches marketing names). */
export function displayPlanName(key: CanonicalInvestmentPlan): string {
  switch (key) {
    case "Starter":
      return "Starter Level";
    case "Growth":
      return "Growth Level";
    case "Pro":
      return "Pro Level";
    case "Elite":
      return "Elite Level";
    default:
      return key;
  }
}

export const PLAN_DAILY_COMPOUND_PERCENT: Record<
  CanonicalInvestmentPlan,
  number
> = {
  Starter: 5,
  Growth: 7,
  Pro: 10,
  Elite: 15,
};

export function dailyCompoundLabel(key: CanonicalInvestmentPlan): string {
  return `${PLAN_DAILY_COMPOUND_PERCENT[key]}% Daily Compound`;
}

/** USD deposit window per tier (inclusive). Elite has no upper cap in app + DB. */
export const PLAN_DEPOSIT_RANGE_USD: Record<
  CanonicalInvestmentPlan,
  { min: number; max: number | null }
> = {
  Starter: { min: 200, max: 500 },
  Growth: { min: 500, max: 1500 },
  Pro: { min: 1500, max: 5000 },
  Elite: { min: 5000, max: null },
};

export function formatDepositRangeDescription(
  key: CanonicalInvestmentPlan,
): string {
  const { min, max } = PLAN_DEPOSIT_RANGE_USD[key];
  if (max === null) return `$${min.toLocaleString()}+`;
  return `$${min.toLocaleString()} — $${max.toLocaleString()}`;
}

/** Client-side guard; DB trigger is authoritative. */
export function validateDepositAmountForPlan(
  amount: number,
  planRaw: string | null | undefined,
): string | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Enter a valid positive amount.";
  }
  const key = normalizeInvestmentPlan(planRaw);
  const { min, max } = PLAN_DEPOSIT_RANGE_USD[key];
  if (amount < min) {
    return `For ${displayPlanName(key)}, the minimum deposit is $${min.toLocaleString()} (upgrade your tier on Investment Plans for a wider range).`;
  }
  if (max !== null && amount > max) {
    return `For ${displayPlanName(key)}, the maximum deposit is $${max.toLocaleString()} (choose a higher tier or submit multiple requests).`;
  }
  return null;
}

export function tierRank(plan: CanonicalInvestmentPlan): number {
  return ORDER[plan];
}

/** Prefer higher tier numerically — used for downgrade warning in UI only. */
export function isTierDowngrade(
  fromRaw: string | null | undefined,
  to: CanonicalInvestmentPlan,
): boolean {
  return tierRank(normalizeInvestmentPlan(fromRaw)) > tierRank(to);
}
