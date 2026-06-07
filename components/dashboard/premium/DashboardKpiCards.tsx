"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import {
  buildSparklineSeries,
  MiniSparkline,
} from "@/components/dashboard/premium/MiniSparkline";
import { DASHBOARD_CARD, DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";
import { formatFiat, type FiatCurrencyCode } from "@/lib/currencies";
import { formatMoneyAmount } from "@/lib/formatMoney";
import { fromUsd, type FxRateMap } from "@/lib/exchangeRates";
import { displayInvestedCapitalUsd, todayPnlPercent } from "@/lib/investorBalanceMetrics";
import { fmtAssetAmount, type P2pAssetCode } from "@/lib/p2pAssets";

type DashboardKpiCardsProps = {
  showBalance: boolean;
  balance: number;
  totalProfit: number;
  withdrawable: number;
  todayPnlUsd: number;
  displayCrypto: P2pAssetCode;
  displayCurrency: FiatCurrencyCode;
  fxRates: FxRateMap;
};

function formatCryptoValue(
  show: boolean,
  usd: number,
  displayCrypto: P2pAssetCode,
  fxRates: FxRateMap,
): string {
  if (!show) return "••••••";
  if (displayCrypto === "BTC") {
    return fmtAssetAmount("BTC", fromUsd(usd, "BTC", fxRates));
  }
  return formatMoneyAmount(usd);
}

function formatFiatHint(
  show: boolean,
  usd: number,
  displayCurrency: FiatCurrencyCode,
  fxRates: FxRateMap,
): string {
  if (!show) return "••••";
  return formatFiat(fromUsd(usd, displayCurrency, fxRates), displayCurrency);
}

function growthLabel(show: boolean, delta: number, base: number): string {
  if (!show) return "—";
  const pct = todayPnlPercent(delta, base);
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function DashboardKpiCards({
  showBalance,
  balance,
  totalProfit,
  withdrawable,
  todayPnlUsd,
  displayCrypto,
  displayCurrency,
  fxRates,
}: DashboardKpiCardsProps) {
  const investedCapital = displayInvestedCapitalUsd(balance);
  const cards = [
    {
      title: "Total Balance",
      value: formatCryptoValue(showBalance, balance, displayCrypto, fxRates),
      fiatHint: formatFiatHint(showBalance, balance, displayCurrency, fxRates),
      growth: growthLabel(showBalance, todayPnlUsd, balance),
      growthPositive: todayPnlUsd >= 0,
      spark: buildSparklineSeries(balance, todayPnlUsd),
      color: "#D4AF37",
      gradientId: "kpi-gold",
      href: "/dashboard/balance",
    },
    {
      title: "Total Profits",
      value: formatCryptoValue(showBalance, totalProfit, displayCrypto, fxRates),
      fiatHint: formatFiatHint(showBalance, totalProfit, displayCurrency, fxRates),
      growth: growthLabel(showBalance, todayPnlUsd, Math.max(totalProfit, 1)),
      growthPositive: todayPnlUsd >= 0,
      spark: buildSparklineSeries(totalProfit, todayPnlUsd * 0.5),
      color: "#00C076",
      gradientId: "kpi-green",
      href: "/dashboard/balance",
    },
    {
      title: "Invested Capital",
      value: formatCryptoValue(showBalance, investedCapital, displayCrypto, fxRates),
      fiatHint: formatFiatHint(showBalance, investedCapital, displayCurrency, fxRates),
      growth: growthLabel(showBalance, todayPnlUsd, investedCapital),
      growthPositive: todayPnlUsd >= 0,
      spark: buildSparklineSeries(investedCapital, investedCapital * 0.02),
      color: "#A78BFA",
      gradientId: "kpi-purple",
      href: "/investment-plans",
    },
    {
      title: "Available Balance",
      value: formatCryptoValue(showBalance, withdrawable, displayCrypto, fxRates),
      fiatHint: formatFiatHint(showBalance, withdrawable, displayCurrency, fxRates),
      growth: growthLabel(showBalance, todayPnlUsd, Math.max(withdrawable, 1)),
      growthPositive: todayPnlUsd >= 0,
      spark: buildSparklineSeries(withdrawable, todayPnlUsd * 0.8),
      color: "#60A5FA",
      gradientId: "kpi-blue",
      href: "/dashboard/balance",
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: index * 0.05 }}
          whileHover={{ y: -2 }}
        >
          <Link
            href={card.href}
            className={`${DASHBOARD_CARD} group relative block overflow-hidden p-5 transition-shadow hover:shadow-[0_12px_40px_rgba(0,0,0,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/50`}
            aria-label={`${card.title} — view details`}
          >
            <div
              className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl transition group-hover:opacity-30"
              style={{ backgroundColor: card.color }}
              aria-hidden
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium" style={{ color: DASHBOARD_MUTED }}>
                  {card.title}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-white transition group-hover:text-[#F5E6B3] sm:text-[1.75rem]">
                  {card.value}
                </p>
                <p className="mt-1 text-xs tabular-nums" style={{ color: DASHBOARD_MUTED }}>
                  {card.fiatHint}
                </p>
                <p
                  className={`mt-1 text-xs font-medium tabular-nums ${
                    card.growthPositive ? "text-[#00C076]" : "text-red-400"
                  }`}
                >
                  {card.growth}
                </p>
              </div>
              <MiniSparkline data={card.spark} color={card.color} gradientId={card.gradientId} />
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
