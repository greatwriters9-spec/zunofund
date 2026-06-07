"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

import { CryptoUnitPicker } from "@/components/currency/CryptoUnitPicker";
import { CurrencyPicker } from "@/components/currency/CurrencyPicker";
import { formatMoneyAmount } from "@/lib/formatMoney";
import { formatFiat, getFiatCurrency, type FiatCurrencyCode } from "@/lib/currencies";
import { fromUsd } from "@/lib/exchangeRates";
import type { FxRateMap } from "@/lib/exchangeRates";
import { fmtAssetAmount, type P2pAssetCode } from "@/lib/p2pAssets";
import { DashboardTierBadge } from "@/components/dashboard/premium/DashboardTierBadge";
import { todayPnlPercent } from "@/lib/investorBalanceMetrics";
import type { CanonicalInvestmentPlan } from "@/lib/investmentPlans";

type InvestorBalanceBlockProps = {
  balanceUsd: number;
  showBalance: boolean;
  onToggleShowBalance: () => void;
  displayCrypto: P2pAssetCode;
  displayCurrency: FiatCurrencyCode;
  onDisplayCryptoChange?: (unit: P2pAssetCode) => void;
  onDisplayCurrencyChange?: (code: FiatCurrencyCode) => void;
  fxRates: FxRateMap;
  todayPnlUsd: number;
  /** Dashboard: amount links to balance page. Detail: static display. */
  amountLinksToBalance?: boolean;
  showAddFunds?: boolean;
  showCurrencyPickers?: boolean;
  planKey?: CanonicalInvestmentPlan;
  className?: string;
};

function estValueLabel(unit: P2pAssetCode): string {
  return `Est. Total Value (${unit})`;
}

export function InvestorBalanceBlock({
  balanceUsd,
  showBalance,
  onToggleShowBalance,
  displayCrypto,
  displayCurrency,
  onDisplayCryptoChange,
  onDisplayCurrencyChange,
  fxRates,
  todayPnlUsd,
  amountLinksToBalance = false,
  showAddFunds = false,
  showCurrencyPickers = false,
  planKey,
  className = "",
}: InvestorBalanceBlockProps) {
  const hidden = "••••••";
  const fiatMeta = getFiatCurrency(displayCurrency);

  const coreAmount =
    displayCrypto === "BTC"
      ? fmtAssetAmount("BTC", fromUsd(balanceUsd, "BTC", fxRates))
      : formatMoneyAmount(balanceUsd);

  const fiatLine = showBalance
    ? formatFiat(fromUsd(balanceUsd, displayCurrency, fxRates), displayCurrency)
    : hidden;

  const pnlPct = todayPnlPercent(todayPnlUsd, balanceUsd);
  const pnlSign = todayPnlUsd >= 0 ? "+" : "";
  const pnlPctSign = pnlPct >= 0 ? "+" : "";
  const pnlLine = showBalance
    ? `Today's PNL ${pnlSign}${formatMoneyAmount(todayPnlUsd)} USDT (${pnlPctSign}${pnlPct.toFixed(1)}%)`
    : hidden;

  const amountClass =
    "text-4xl font-semibold tabular-nums tracking-tight text-white transition hover:text-[#F5E6B3] sm:text-5xl md:text-[3.25rem]";

  const amountInner = <span className={amountClass}>{showBalance ? coreAmount : hidden}</span>;

  const hideToggle = (
    <button
      type="button"
      onClick={onToggleShowBalance}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 text-sm text-[#8A93A5] transition hover:border-[#D4AF37]/35 hover:text-white"
      aria-pressed={showBalance}
      aria-label={showBalance ? "Hide balance" : "Show balance"}
    >
      {showBalance ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
      <span className="text-xs">{showBalance ? "Hide" : "Show"}</span>
    </button>
  );

  return (
    <div className={`dashboard-balance-stable border-b border-white/[0.06] pb-8 ${className}`}>
      <div className="flex min-w-0 items-center gap-2">
        <p className="text-base font-normal tracking-tight text-white">{estValueLabel(displayCrypto)}</p>
        {hideToggle}
      </div>

      <div className="mt-2 flex items-center justify-between gap-4">
        {amountLinksToBalance ? (
          <Link
            href="/dashboard/balance"
            className="min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/50"
            aria-label="View balance details"
          >
            {amountInner}
          </Link>
        ) : (
          <div className="min-w-0">{amountInner}</div>
        )}

        {showAddFunds ? (
          <Link
            href="/deposit"
            className="shrink-0 self-center rounded-xl bg-gradient-to-r from-[#F7E3A0] via-[#D4AF37] to-[#EAC54F] px-3 py-2 text-xs font-bold uppercase tracking-wide text-black shadow-[0_0_20px_rgba(212,175,55,0.2)] transition hover:brightness-105 lg:hidden"
          >
            Add Funds
          </Link>
        ) : null}
      </div>

      <p className="mt-2 text-base tabular-nums text-[#8A93A5]" title={`${fiatMeta.name} · ${fiatMeta.code}`}>
        {fiatLine}
      </p>

      <p
        className={`mt-1.5 text-sm tabular-nums ${
          todayPnlUsd >= 0 ? "text-[#00C076]" : "text-red-400"
        }`}
      >
        {pnlLine}
      </p>

      {planKey ? <DashboardTierBadge planKey={planKey} className="mt-3" /> : null}

      {showCurrencyPickers && onDisplayCryptoChange && onDisplayCurrencyChange ? (
        <div className="mt-4 flex flex-row flex-wrap items-center gap-2">
          <CryptoUnitPicker value={displayCrypto} onChange={onDisplayCryptoChange} size="sm" />
          <CurrencyPicker
            value={displayCurrency}
            onChange={onDisplayCurrencyChange}
            size="sm"
            align="start"
            triggerVariant="code-only"
          />
        </div>
      ) : null}
    </div>
  );
}
