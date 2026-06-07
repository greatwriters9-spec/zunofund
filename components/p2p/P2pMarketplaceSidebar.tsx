"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList, Search } from "lucide-react";

import type { P2pAssetCode, P2pMarketTab } from "@/components/p2p/p2pTypes";
import { CryptoPicker } from "@/components/market-pickers/CryptoPicker";
import { DEPOSIT_EXCHANGE_ASSETS } from "@/lib/depositExchangeAssets";
import { PaymentMethodPicker } from "@/components/payment-methods/PaymentMethodPicker";

type P2pMarketplaceSidebarProps = {
  tab: P2pMarketTab;
  onTabChange: (t: P2pMarketTab) => void;
  asset: P2pAssetCode;
  onAssetChange: (a: P2pAssetCode) => void;
  amount: string;
  onAmountChange: (v: string) => void;
  /** Empty string = all methods */
  paymentMethod: string;
  onPaymentMethodChange: (code: string) => void;
  onSearch: () => void;
  loading?: boolean;
  sellPayoutValue: string;
  onSellPayoutChange: (v: string) => void;
  /** When set, the trade history shortcut focuses active trades inline in the main panel. */
  onOpenActiveTrades?: () => void;
};

export function P2pMarketplaceSidebar({
  tab,
  onTabChange,
  asset,
  onAssetChange,
  amount,
  onAmountChange,
  paymentMethod,
  onPaymentMethodChange,
  onSearch,
  loading,
  sellPayoutValue,
  onSellPayoutChange,
  onOpenActiveTrades,
}: P2pMarketplaceSidebarProps) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-b border-[#D4AF37]/15 bg-[#05080F]/90 p-4 max-lg:touch-pan-y lg:min-h-[100dvh] lg:gap-5 lg:border-b-0 lg:border-r lg:p-5 lg:pt-6 lg:max-w-[380px] xl:max-w-[430px]">
      <CryptoPicker
        variant="field"
        fieldLabel="Asset"
        value={asset}
        onChange={(code) => {
          if (code) onAssetChange(code as typeof asset);
        }}
        context="portal"
        assetList={DEPOSIT_EXCHANGE_ASSETS}
        forceSelectable
        displayLabel={asset}
      />

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Direction</p>
        <div
          className="mt-2 flex flex-row gap-2 rounded-xl border border-white/10 bg-black/30 p-1"
          role="tablist"
          aria-label="Trade direction"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "buy"}
            onClick={() => onTabChange("buy")}
            className={`min-w-0 flex-1 rounded-lg px-3 py-3 text-sm font-bold uppercase tracking-wide transition ${
              tab === "buy"
                ? "bg-emerald-600 text-white shadow-inner ring-1 ring-emerald-400/40"
                : "text-zinc-400 hover:text-[#F5E6B3]"
            }`}
          >
            Buy
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "sell"}
            onClick={() => onTabChange("sell")}
            className={`min-w-0 flex-1 rounded-lg px-3 py-3 text-sm font-bold uppercase tracking-wide transition ${
              tab === "sell"
                ? "bg-red-600 text-white shadow-inner ring-1 ring-red-400/40"
                : "text-zinc-400 hover:text-[#F5E6B3]"
            }`}
          >
            Sell
          </button>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-3">
        <label className="block min-w-0">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Amount USDT
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="500"
            className="w-full rounded-xl border border-white/12 bg-black/45 px-3 py-3 text-base font-semibold tabular-nums text-white outline-none placeholder:text-zinc-600 focus:border-[#D4AF37]/5 focus:ring-2 focus:ring-[#D4AF37]/25"
          />
        </label>

        <div className="min-w-0">
          <PaymentMethodPicker
            variant="field"
            fieldLabel="Pay method"
            value={paymentMethod}
            onChange={onPaymentMethodChange}
            allowAllMethods
          />
          <p className="mt-2 text-[9px] leading-snug text-zinc-600">
            Including Airtel Money, Sendwave, banks & wallets.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/25 py-1">
        {onOpenActiveTrades ? (
          <button
            type="button"
            onClick={onOpenActiveTrades}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-bold uppercase tracking-wide text-zinc-100 transition hover:bg-white/[0.04]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <ClipboardList className="h-4 w-4 shrink-0 text-[#D4AF37]/85" aria-hidden />
              <span className="min-w-0">
                Active trades
                <span className="mt-0.5 block text-[10px] font-medium normal-case tracking-normal text-zinc-500">
                  Open settling tickets here · full history →
                </span>
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#D4AF37]/80" aria-hidden />
          </button>
        ) : (
          <Link
            href="/p2p/history"
            className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-zinc-100 transition hover:bg-white/[0.04]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <ClipboardList className="h-4 w-4 shrink-0 text-[#D4AF37]/85" aria-hidden />
              <span className="min-w-0">
                Trade history
                <span className="mt-0.5 block text-[10px] font-medium normal-case tracking-normal text-zinc-500">
                  Active, completed &amp; cancelled
                </span>
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#D4AF37]/80" aria-hidden />
          </Link>
        )}
      </div>

      {tab === "sell" ? (
        <div>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              YOUR PAYOUT DETAILS <span className="text-red-400">*</span>
            </span>
            <textarea
              value={sellPayoutValue}
              onChange={(e) => onSellPayoutChange(e.target.value)}
              rows={5}
              placeholder="Where the merchant should send fiat…"
              className="mt-2 w-full resize-y rounded-xl border border-white/12 bg-black/40 px-3 py-3 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-red-400/35 focus:ring-1 focus:ring-red-400/25"
            />
          </label>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onSearch}
        disabled={loading || asset !== "USDT"}
        title={asset !== "USDT" ? "Select USDT to search" : undefined}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        {loading ? "Searching…" : "SEARCH OFFERS"}
      </button>

      <section className="hidden rounded-xl border border-white/10 bg-black/35 p-4 lg:block">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#D4AF37]/90">How P2P works</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-4 text-[11px] leading-relaxed text-zinc-400">
          <li>
            Pick <strong className="text-zinc-200">buy</strong> or <strong className="text-zinc-200">sell</strong>, enter a
            size, and optionally a payment rail.
          </li>
          <li>
            Open an ad → you&apos;ll settle bank / wallet / mobile money{" "}
            <strong className="text-zinc-200">outside</strong> the app; use the ticket chat &amp; proof fields.
          </li>
          <li>
            <strong className="text-zinc-200">Buying</strong> USDT confirms when the merchant releases USDT to your
            account balance.
          </li>
          <li>
            <strong className="text-zinc-200">Selling</strong> settles when you confirm you received fiat and tap release
            (FIFO withdrawals apply).
          </li>
        </ol>
        <div className="mt-4 flex flex-col gap-2 text-[11px] font-semibold uppercase tracking-wide">
          <Link href="/p2p/history" className="text-[#D4AF37] hover:text-[#F5E6B3]">
            → P2P transaction history
          </Link>
          <Link href="/dashboard" className="text-zinc-500 hover:text-[#F5E6B3]">
            ← Investor dashboard
          </Link>
        </div>
      </section>
    </aside>
  );
}
