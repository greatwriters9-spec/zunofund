import { formatUsdAmount } from "@/lib/formatMoney";
import {
  normalizeInvestmentPlan,
  type CanonicalInvestmentPlan,
} from "@/lib/investmentPlanIdentity";
import type {
  AnnouncementRow,
  InvestmentPlanRow,
  PromotionSettingsRow,
} from "@/lib/platformConfig/types";

export function findPlanByName(
  plans: InvestmentPlanRow[],
  raw: string | null | undefined,
): InvestmentPlanRow | null {
  const key = normalizeInvestmentPlan(raw);
  return (
    plans.find((p) => normalizeInvestmentPlan(p.name) === key) ??
    plans.find((p) => p.name.toLowerCase().includes(key.toLowerCase())) ??
    null
  );
}

export function planDailyRoi(
  plans: InvestmentPlanRow[],
  key: CanonicalInvestmentPlan,
): number {
  return findPlanByName(plans, key)?.daily_roi ?? 10;
}

export function planDepositRange(
  plans: InvestmentPlanRow[],
  key: CanonicalInvestmentPlan,
): { min: number; max: number | null } {
  const row = findPlanByName(plans, key);
  if (!row) return { min: 100, max: 500 };
  return {
    min: row.min_deposit,
    max: row.max_deposit >= 999999999 ? null : row.max_deposit,
  };
}

export function formatPlanDepositRange(
  plans: InvestmentPlanRow[],
  key: CanonicalInvestmentPlan,
): string {
  const { min, max } = planDepositRange(plans, key);
  if (max === null) return `${formatUsdAmount(min)}+`;
  return `${formatUsdAmount(min)} — ${formatUsdAmount(max)}`;
}

export function dailyCompoundLabelFromPlans(
  plans: InvestmentPlanRow[],
  key: CanonicalInvestmentPlan,
): string {
  return `${planDailyRoi(plans, key)}% Daily Compound`;
}

export function platformMinDepositUsd(plans: InvestmentPlanRow[]): number {
  const active = plans.filter((p) => p.promotion_active);
  const source = active.length > 0 ? active : plans;
  if (source.length === 0) return 100;
  return Math.min(...source.map((p) => p.min_deposit));
}

export function tierThresholdUsd(
  plans: InvestmentPlanRow[],
  key: CanonicalInvestmentPlan,
): number {
  return findPlanByName(plans, key)?.min_deposit ?? 0;
}

export function tierFromPrincipalUsd(
  plans: InvestmentPlanRow[],
  usd: number,
): CanonicalInvestmentPlan {
  const x = Number.isFinite(usd) ? usd : 0;
  const sorted = [...plans].sort((a, b) => b.sort_order - a.sort_order);
  for (const plan of sorted) {
    if (x >= plan.min_deposit && x <= plan.max_deposit) {
      return normalizeInvestmentPlan(plan.name);
    }
  }
  const lowest = [...plans].sort((a, b) => a.sort_order - b.sort_order)[0];
  return normalizeInvestmentPlan(lowest?.name ?? "Starter");
}

export function exampleDepositForPlan(plan: InvestmentPlanRow): number {
  if (plan.max_deposit >= 999999999) {
    return Math.max(plan.min_deposit, 5000);
  }
  return plan.max_deposit;
}

export function projectedReturnLabel(plan: InvestmentPlanRow): string {
  return `Up to ${formatUsdAmount(plan.promotion_return_target)}`;
}

export function promotionEndLabel(promotion: PromotionSettingsRow | null): string {
  if (!promotion?.promotion_end_date) return "January 1, 2027";
  const d = new Date(promotion.promotion_end_date);
  if (Number.isNaN(d.getTime())) return "January 1, 2027";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function daysUntilPromotionEnd(promotion: PromotionSettingsRow | null): number {
  if (!promotion?.promotion_end_date) return 0;
  const end = new Date(promotion.promotion_end_date).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

export function pickFeaturedAnnouncement(
  announcements: AnnouncementRow[],
): AnnouncementRow | null {
  const featured = announcements.filter((a) => a.featured && a.published);
  const pool = featured.length > 0 ? featured : announcements.filter((a) => a.published);
  if (pool.length === 0) return null;
  return [...pool].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];
}

export function formatAnnouncementMonthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
