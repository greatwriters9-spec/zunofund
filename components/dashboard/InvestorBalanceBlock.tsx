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
import { EARLY_MEMBER_PROMOTION } from "@/components/landing/landingData";
import { todayPnlPercent } from "@/lib/investorBalanceMetrics";

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
};

function estValueLabel(unit: P2pAssetCode): string {
  return `Est. Total Value (${unit})`;
}

function PromoDeadlineDateLoud() {
  return (
    <span className="font-black uppercase tracking-wide text-yellow-300 drop-shadow-[0_0_14px_rgba(250,204,21,0.45)]">
      {EARLY_MEMBER_PROMOTION.endDateLabel}
    </span>
  );
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
    "text-4xl font-bold tabular-nums tracking-tight text-white transition hover:text-yellow-100 sm:text-5xl md:text-[3.25rem]";

  const amountInner = <span className={amountClass}>{showBalance ? coreAmount : hidden}</span>;

  const hideToggle = (
    <button
      type="button"
      onClick={onToggleShowBalance}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-transparent px-2.5 text-sm text-zinc-300 transition hover:border-yellow-500/50 hover:text-white"
      aria-pressed={showBalance}
      aria-label={showBalance ? "Hide balance" : "Show balance"}
    >
      {showBalance ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
      <span className="text-xs">{showBalance ? "Hide" : "Show"}</span>
    </button>
  );

  return (
    <div className="dashboard-balance-stable border-b border-zinc-800/90 pb-8">
      <div className="flex min-w-0 items-center gap-2">
        <p className="text-base font-normal tracking-tight text-zinc-100">{estValueLabel(displayCrypto)}</p>
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
            className="shrink-0 self-center rounded-lg border border-yellow-500/45 bg-yellow-500 px-3 py-2 text-xs font-bold uppercase tracking-wide text-black transition hover:bg-yellow-400 lg:hidden"
          >
            Add Funds
          </Link>
        ) : null}
      </div>

      <p className="mt-2 text-base tabular-nums text-zinc-500" title={`${fiatMeta.name} · ${fiatMeta.code}`}>
        {fiatLine}
      </p>

      <p
        className={`mt-1.5 text-sm tabular-nums ${
          todayPnlUsd >= 0 ? "text-emerald-400/90" : "text-red-400/90"
        }`}
      >
        {pnlLine}
      </p>

      <div className="mt-4 max-w-lg space-y-2 border-l border-amber-500/35 pl-3.5">
        <p className="text-sm font-medium leading-snug text-zinc-300">
          ⚡ Early Member Opportunity Ends <PromoDeadlineDateLoud />
        </p>
        <p className="text-sm leading-relaxed text-zinc-500">
          Earn promotional growth rewards on eligible balances until{" "}
          <span className="font-medium text-amber-400/90">{EARLY_MEMBER_PROMOTION.endDateLabel}</span>. After
          this date, Zuno will transition to a pure P2P marketplace and new reward enrollments will close
          permanently.
        </p>
      </div>

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
