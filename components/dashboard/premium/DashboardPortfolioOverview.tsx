"use client";

import { motion } from "framer-motion";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { DASHBOARD_CARD, DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";
import { formatMoneyAmount } from "@/lib/formatMoney";
import { fromUsd } from "@/lib/exchangeRates";
import type { FxRateMap } from "@/lib/exchangeRates";
import { portfolioInvestedSliceUsd } from "@/lib/investorBalanceMetrics";

type DashboardPortfolioOverviewProps = {
  showBalance: boolean;
  balance: number;
  withdrawable: number;
  fxRates: FxRateMap;
};

const COLORS = ["#D4AF37", "#00C076", "#A78BFA", "#60A5FA"];

export function DashboardPortfolioOverview({
  showBalance,
  balance,
  withdrawable,
  fxRates,
}: DashboardPortfolioOverviewProps) {
  const investedAmount = portfolioInvestedSliceUsd(balance, withdrawable);
  const rawSlices = [
    ...(withdrawable > 0 ? [{ name: "Available", value: withdrawable }] : []),
    ...(investedAmount > 0 ? [{ name: "Invested", value: investedAmount }] : []),
  ];

  const total = rawSlices.reduce((sum, slice) => sum + slice.value, 0) || balance || 1;
  const slices =
    rawSlices.length > 0
      ? rawSlices
      : [{ name: "USDT", value: Math.max(balance, 0) }];

  const btcEquiv = fromUsd(investedAmount, "BTC", fxRates);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`${DASHBOARD_CARD} flex h-full min-h-[320px] flex-col p-5 sm:p-6`}
    >
      <h2 className="text-base font-semibold text-white">Portfolio Overview</h2>

      <div className="mt-6 flex flex-1 flex-col items-center gap-6 sm:flex-row sm:items-center">
        <div className="relative h-[200px] w-[200px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={88}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {slices.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: DASHBOARD_MUTED }}>
              Total Value
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white">
              {showBalance ? formatMoneyAmount(balance) : "••••••"}
            </p>
          </div>
        </div>

        <ul className="w-full min-w-0 flex-1 space-y-3">
          {slices.map((slice, index) => {
            const pct = ((slice.value / total) * 100).toFixed(1);
            const detail =
              slice.name === "Invested" && showBalance
                ? `≈ ${btcEquiv.toFixed(6)} BTC`
                : `${pct}%`;
            return (
              <li key={slice.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    aria-hidden
                  />
                  <span className="font-medium text-zinc-200">{slice.name}</span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="block text-white">
                    {showBalance ? formatMoneyAmount(slice.value) : "••••"}
                  </span>
                  <span className="text-xs" style={{ color: DASHBOARD_MUTED }}>
                    {detail}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </motion.div>
  );
}
