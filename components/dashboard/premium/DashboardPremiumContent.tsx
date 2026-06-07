"use client";

import Link from "next/link";
import { Store } from "lucide-react";

import { DashboardActivePlanCard } from "@/components/dashboard/premium/DashboardActivePlanCard";
import { DashboardEliteUpgradeAd } from "@/components/dashboard/premium/DashboardEliteUpgradeAd";
import { DashboardAssetGrowthCard } from "@/components/dashboard/premium/DashboardAssetGrowthCard";
import { DashboardLiveMarketsStripe } from "@/components/dashboard/premium/DashboardLiveMarketsStripe";
import { DashboardCompactSupport } from "@/components/dashboard/premium/DashboardCompactSupport";
import { DashboardKpiCards } from "@/components/dashboard/premium/DashboardKpiCards";
import { DashboardPortfolioOverview } from "@/components/dashboard/premium/DashboardPortfolioOverview";
import {
  DashboardRecentTransactions,
  type DashboardActivity,
} from "@/components/dashboard/premium/DashboardRecentTransactions";
import { DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";
import type { FiatCurrencyCode } from "@/lib/currencies";
import type { FxRateMap } from "@/lib/exchangeRates";
import type { CanonicalInvestmentPlan } from "@/lib/investmentPlans";
import type { P2pAssetCode } from "@/lib/p2pAssets";

type MerchantProfile = { status: string } | null;

type DashboardPremiumContentProps = {
  showKpi?: boolean;
  showCompactSupport?: boolean;
  showBalance: boolean;
  balance: number;
  withdrawable: number;
  totalProfit: number;
  todayPnlUsd: number;
  fxRates: FxRateMap;
  displayCrypto?: P2pAssetCode;
  displayCurrency?: FiatCurrencyCode;
  activities: DashboardActivity[];
  planKey: CanonicalInvestmentPlan;
  accountStatus: string;
  merchantProfile?: MerchantProfile;
};

export function DashboardPremiumContent({
  showKpi = true,
  showCompactSupport = true,
  showBalance,
  balance,
  withdrawable,
  totalProfit,
  todayPnlUsd,
  fxRates,
  displayCrypto = "USDT",
  displayCurrency = "USD",
  activities,
  planKey,
  accountStatus,
  merchantProfile,
}: DashboardPremiumContentProps) {
  return (
    <div className="space-y-6 lg:space-y-8">
      {showKpi ? (
        <DashboardKpiCards
          showBalance={showBalance}
          balance={balance}
          totalProfit={totalProfit}
          withdrawable={withdrawable}
          todayPnlUsd={todayPnlUsd}
          displayCrypto={displayCrypto}
          displayCurrency={displayCurrency}
          fxRates={fxRates}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardPortfolioOverview
          showBalance={showBalance}
          balance={balance}
          withdrawable={withdrawable}
          fxRates={fxRates}
        />
        <DashboardAssetGrowthCard />
      </div>

      <DashboardLiveMarketsStripe />

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardRecentTransactions activities={activities} />
        <div className="flex flex-col gap-6">
          <DashboardActivePlanCard
            showBalance={showBalance}
            planKey={planKey}
            balance={balance}
            totalProfit={totalProfit}
            accountStatus={accountStatus}
          />
          <DashboardEliteUpgradeAd planKey={planKey} balance={balance} />
        </div>
      </div>

      {merchantProfile &&
      (merchantProfile.status === "active" || merchantProfile.status === "pending") ? (
        <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.04] p-4 sm:p-5">
          <div className="flex gap-3">
            <Store className="mt-0.5 h-5 w-5 shrink-0 text-[#D4AF37]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]/90">
                Merchant offers
              </p>
              {merchantProfile.status === "active" ? (
                <p className="mt-1 text-sm" style={{ color: DASHBOARD_MUTED }}>
                  Manage P2P listings from your merchant dashboard.
                </p>
              ) : (
                <p className="mt-1 text-sm" style={{ color: DASHBOARD_MUTED }}>
                  Your merchant application is pending approval.
                </p>
              )}
              <Link
                href="/merchant"
                className="mt-3 inline-flex text-xs font-semibold text-[#D4AF37] hover:text-[#F5E6B3]"
              >
                Open merchant →
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {showCompactSupport ? <DashboardCompactSupport /> : null}
    </div>
  );
}
