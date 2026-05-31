import {
  PLAN_DAILY_COMPOUND_PERCENT,
  type CanonicalInvestmentPlan,
} from "@/lib/investmentPlans";

export type ProfitRow = {
  amount: number;
  status: string;
  created_at: string;
};

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const PENDING_PROFIT_STATUSES = new Set(["pending", "processing", "rejected", "cancelled", "failed"]);

/** Ledger rows that actually credited balance (daily compound + manual). */
export function isCreditedProfitStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toLowerCase();
  if (!s || PENDING_PROFIT_STATUSES.has(s)) return false;
  return s === "approved" || s === "completed" || s === "credited" || s === "success";
}

/** Sum of profits credited today (local calendar day). */
export function sumTodayPnlUsd(profits: ProfitRow[]): number {
  const now = new Date();
  return profits.reduce((sum, row) => {
    if (!isCreditedProfitStatus(row.status)) return sum;
    const at = new Date(row.created_at);
    if (!Number.isFinite(at.getTime()) || !isSameLocalDay(at, now)) return sum;
    return sum + (Number(row.amount) || 0);
  }, 0);
}

export function todayPnlPercent(todayPnlUsd: number, balanceUsd: number): number {
  if (!(balanceUsd > 0) || !Number.isFinite(todayPnlUsd)) return 0;
  return (todayPnlUsd / balanceUsd) * 100;
}

/** Projected 30-day compound gain on current balance at plan daily rate. */
export function projectedMonthlyEarningsUsd(
  balanceUsd: number,
  plan: CanonicalInvestmentPlan,
): number {
  const b = Number.isFinite(balanceUsd) ? balanceUsd : 0;
  if (b <= 0) return 0;
  const dailyRate = PLAN_DAILY_COMPOUND_PERCENT[plan] / 100;
  return b * (Math.pow(1 + dailyRate, 30) - 1);
}
