/** Canonical tiers — names must match investment_plans.name in the database. */
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

export function tierRank(plan: CanonicalInvestmentPlan): number {
  return ORDER[plan];
}
