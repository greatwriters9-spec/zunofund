"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Eye, EyeOff, UserRound } from "lucide-react";

import { InvestorBalanceBlock } from "@/components/dashboard/InvestorBalanceBlock";
import { DashboardPremiumContent } from "@/components/dashboard/premium/DashboardPremiumContent";
import type { DashboardActivity } from "@/components/dashboard/premium/DashboardRecentTransactions";
import { DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";
import type { FiatCurrencyCode } from "@/lib/currencies";
import type { FxRateMap } from "@/lib/exchangeRates";
import type { CanonicalInvestmentPlan } from "@/lib/investmentPlans";
import type { P2pAssetCode } from "@/lib/p2pAssets";

type MerchantProfile = { status: string } | null;

type DashboardPremiumViewProps = {
  investorName: string;
  avatarUrl?: string | null;
  profileAvatarBroken: boolean;
  onProfileAvatarError: () => void;
  planKey: CanonicalInvestmentPlan;
  accountStatus: string;
  showBalance: boolean;
  onToggleShowBalance: () => void;
  balance: number;
  withdrawable: number;
  totalProfit: number;
  todayPnlUsd: number;
  fxRates: FxRateMap;
  displayCrypto: P2pAssetCode;
  displayCurrency: FiatCurrencyCode;
  onDisplayCryptoChange: (unit: P2pAssetCode) => void;
  onDisplayCurrencyChange: (code: FiatCurrencyCode) => void;
  activities: DashboardActivity[];
  merchantProfile?: MerchantProfile;
};

export function DashboardPremiumView({
  investorName,
  avatarUrl,
  profileAvatarBroken,
  onProfileAvatarError,
  planKey,
  accountStatus,
  showBalance,
  onToggleShowBalance,
  balance,
  withdrawable,
  totalProfit,
  todayPnlUsd,
  fxRates,
  displayCrypto,
  displayCurrency,
  onDisplayCryptoChange,
  onDisplayCurrencyChange,
  activities,
  merchantProfile,
}: DashboardPremiumViewProps) {
  return (
    <div className="relative min-h-full overflow-x-clip bg-[#05070D] text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,rgba(212,175,55,0.08)_0%,transparent_70%)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-[1400px] space-y-8 px-4 py-5 sm:px-6 lg:py-8">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="flex min-w-0 items-start gap-4">
            <div className="relative hidden h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-[#D4AF37]/25 sm:block">
              {avatarUrl && !profileAvatarBroken ? (
                <Image
                  src={avatarUrl}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-cover"
                  onError={onProfileAvatarError}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-[#D4AF37]/10">
                  <UserRound className="h-6 w-6 text-[#D4AF37]" aria-hidden />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
                Welcome back, {investorName} 👋
              </h1>
              <p className="mt-1 text-sm" style={{ color: DASHBOARD_MUTED }}>
                Here&apos;s what&apos;s happening with your investments today.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleShowBalance}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs font-medium text-zinc-300 transition hover:border-[#D4AF37]/35"
              aria-pressed={showBalance}
            >
              {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {showBalance ? "Hide" : "Show"}
            </button>
            <Link
              href="/dashboard/balance"
              className="inline-flex h-10 items-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-xs font-semibold text-zinc-200 transition hover:border-[#D4AF37]/35"
            >
              Wallet
            </Link>
            <Link
              href="/deposit"
              className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-[#F7E3A0] via-[#D4AF37] to-[#EAC54F] px-5 text-xs font-bold text-black shadow-[0_0_24px_rgba(212,175,55,0.25)] transition hover:brightness-105"
            >
              Deposit
            </Link>
            <Link
              href="/withdraw"
              className="inline-flex h-10 items-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-5 text-xs font-semibold text-zinc-100 transition hover:border-white/[0.2]"
            >
              Withdraw
            </Link>
          </div>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-white/[0.06] bg-[rgba(12,17,28,0.55)] px-5 py-5 sm:px-6"
        >
          <InvestorBalanceBlock
            balanceUsd={balance}
            showBalance={showBalance}
            onToggleShowBalance={onToggleShowBalance}
            displayCrypto={displayCrypto}
            displayCurrency={displayCurrency}
            onDisplayCryptoChange={onDisplayCryptoChange}
            onDisplayCurrencyChange={onDisplayCurrencyChange}
            fxRates={fxRates}
            todayPnlUsd={todayPnlUsd}
            amountLinksToBalance
            showCurrencyPickers
            planKey={planKey}
            className="border-0 pb-0"
          />
        </motion.div>

        <DashboardPremiumContent
          showBalance={showBalance}
          balance={balance}
          withdrawable={withdrawable}
          totalProfit={totalProfit}
          todayPnlUsd={todayPnlUsd}
          fxRates={fxRates}
          displayCrypto={displayCrypto}
          displayCurrency={displayCurrency}
          activities={activities as DashboardActivity[]}
          planKey={planKey}
          accountStatus={accountStatus}
          merchantProfile={merchantProfile}
        />
      </div>
    </div>
  );
}
