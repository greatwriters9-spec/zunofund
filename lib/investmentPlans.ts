import { formatUsdAmount } from "@/lib/formatMoney";
import {
  displayPlanName,
  normalizeInvestmentPlan,
  tierRank,
  type CanonicalInvestmentPlan,
} from "@/lib/investmentPlanIdentity";
export {
  CANONICAL_INVESTMENT_PLANS,
  displayPlanName,
  normalizeInvestmentPlan,
  tierRank,
  type CanonicalInvestmentPlan,
} from "@/lib/investmentPlanIdentity";
import { FALLBACK_PLANS } from "@/lib/platformConfig/fallbacks";
import {
  dailyCompoundLabelFromPlans,
  formatPlanDepositRange,
  platformMinDepositUsd,
  planDailyRoi,
  planDepositRange,
  tierFromPrincipalUsd,
} from "@/lib/platformConfig/helpers";
import type { InvestmentPlanRow } from "@/lib/platformConfig/types";

/** @deprecated Use platformMinDepositUsd(plans) from live config. */
export const MIN_INTEREST_QUALIFYING_USD = platformMinDepositUsd(FALLBACK_PLANS);

/** @deprecated Prefer planDailyRoi(plans, key) from usePlatformConfig(). */
export const PLAN_DAILY_COMPOUND_PERCENT: Record<
  CanonicalInvestmentPlan,
  number
> = {
  Starter: planDailyRoi(FALLBACK_PLANS, "Starter"),
  Growth: planDailyRoi(FALLBACK_PLANS, "Growth"),
  Pro: planDailyRoi(FALLBACK_PLANS, "Pro"),
  Elite: planDailyRoi(FALLBACK_PLANS, "Elite"),
};

export function dailyCompoundLabel(
  key: CanonicalInvestmentPlan,
  plans?: InvestmentPlanRow[] | null,
): string {
  const source = plans?.length ? plans : FALLBACK_PLANS;
  return dailyCompoundLabelFromPlans(source, key);
}

/** @deprecated Prefer planDepositRange(plans, key) from usePlatformConfig(). */
export const PLAN_DEPOSIT_RANGE_USD: Record<
  CanonicalInvestmentPlan,
  { min: number; max: number | null }
> = {
  Starter: planDepositRange(FALLBACK_PLANS, "Starter"),
  Growth: planDepositRange(FALLBACK_PLANS, "Growth"),
  Pro: planDepositRange(FALLBACK_PLANS, "Pro"),
  Elite: planDepositRange(FALLBACK_PLANS, "Elite"),
};

/** Minimum single crypto deposit request; mirrors platform_min_deposit_usd() in Postgres. */
export function minPlatformDepositUsd(plans?: InvestmentPlanRow[] | null): number {
  return platformMinDepositUsd(plans?.length ? plans : FALLBACK_PLANS);
}

/** @deprecated Use minPlatformDepositUsd(plans). */
export const MIN_PLATFORM_DEPOSIT_USD = minPlatformDepositUsd(FALLBACK_PLANS);

/** Highest tier whose bracket contains `usd` (matches SQL investment_plan_slug_for_principal). */
export function canonicalTierFromQualifyingPrincipalUsd(
  usd: number,
  plans?: InvestmentPlanRow[] | null,
): CanonicalInvestmentPlan {
  return tierFromPrincipalUsd(plans?.length ? plans : FALLBACK_PLANS, usd);
}

export function qualifiesForDailyInterest(
  qualifyingPrincipalUsd: number,
  plans?: InvestmentPlanRow[] | null,
): boolean {
  const x = Number.isFinite(qualifyingPrincipalUsd) ? qualifyingPrincipalUsd : 0;
  return x >= minPlatformDepositUsd(plans);
}

export function formatDepositRangeDescription(
  key: CanonicalInvestmentPlan,
  plans?: InvestmentPlanRow[] | null,
): string {
  const source = plans?.length ? plans : FALLBACK_PLANS;
  return formatPlanDepositRange(source, key);
}

/** Client-side guard for deposit amount; DB trigger enforces minimum from investment_plans. */
export function validateMinimumDeposit(
  amount: number,
  plans?: InvestmentPlanRow[] | null,
): string | null {
  const minUsd = minPlatformDepositUsd(plans);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Enter a valid positive amount.";
  }
  if (amount < minUsd) {
    return `The minimum deposit is ${formatUsdAmount(minUsd)}.`;
  }
  return null;
}

/** Prefer higher tier numerically — used for downgrade warning in UI only. */
export function isTierDowngrade(
  fromRaw: string | null | undefined,
  to: CanonicalInvestmentPlan,
): boolean {
  return tierRank(normalizeInvestmentPlan(fromRaw)) > tierRank(to);
}
