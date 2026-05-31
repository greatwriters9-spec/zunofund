import { isCreditedProfitStatus } from "@/lib/investorBalanceMetrics";
import type { ProfitChartDatum } from "@/components/dashboard/ProfitGrowthChart";

export type ProfitRowForChart = {
  amount: number | string;
  status: string;
  created_at: string;
};

export function buildPortfolioGrowthChartData(
  profits: ProfitRowForChart[],
): ProfitChartDatum[] {
  const credited = profits.filter((p) => isCreditedProfitStatus(p.status));
  const chrono = [...credited].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  let cumulativeProfit = 0;
  return chrono.map((profit, index) => {
    cumulativeProfit += Number(profit.amount) || 0;
    return {
      id: index + 1,
      date: new Date(profit.created_at).toLocaleDateString(),
      profit: cumulativeProfit,
    };
  });
}
