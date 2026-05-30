"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ClipboardList, RefreshCcw } from "lucide-react";

import type { P2pAssetCode, P2pMarketTab } from "@/components/p2p/p2pTypes";
import { P2P_PAYMENT_METHOD_OPTIONS } from "@/lib/p2pPaymentMethods";
import { FIAT_CURRENCIES, getFiatCurrency, type FiatCurrencyCode } from "@/lib/currencies";

const OFFER_ASSETS = [
  { code: "USDT" as const, label: "USDT · Tether" },
  { code: "BTC" as const, label: "BTC · Bitcoin" },
];

export type P2pListViewMode = "offers" | "active" | "completed" | "cancelled";

export type OfferSortMode = "rate_asc" | "rate_desc" | "online_first" | "offline_first";

export const OFFER_SORT_OPTIONS: { value: OfferSortMode; label: string }[] = [
  { value: "rate_asc", label: "Rate · low to high" },
  { value: "rate_desc", label: "Rate · high to low" },
  { value: "online_first", label: "Online first" },
  { value: "offline_first", label: "Offline first" },
];

export function offerSortButtonLabel(mode: OfferSortMode): string {
  switch (mode) {
    case "rate_asc":
      return "Rate ↑";
    case "rate_desc":
      return "Rate ↓";
    case "online_first":
      return "Online";
    case "offline_first":
      return "Offline";
  }
}

type DropdownKey = "asset" | "currency" | "method" | "sort" | "trades";

const LIST_VIEW_ROWS: { value: P2pListViewMode; label: string }[] = [
  { value: "offers", label: "Offers · browse ads" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function tradesMenuLabel(mode: P2pListViewMode): string {
  const row = LIST_VIEW_ROWS.find((r) => r.value === mode);
  return row?.label ?? LIST_VIEW_ROWS[0].label;
}

type P2pMarketToolbarProps = {
  tab: P2pMarketTab;
  onTabChange: (t: P2pMarketTab) => void;
  asset: P2pAssetCode;
  onAssetChange: (a: P2pAssetCode) => void;
  amount: string;
  onAmountChange: (v: string) => void;
  /** Empty string means "all currencies"; otherwise narrows offer search to this fiat. */
  fiatCurrency: FiatCurrencyCode | "";
  onFiatCurrencyChange: (code: FiatCurrencyCode | "") => void;
  /** USDT when browsing all currencies; otherwise matches `fiatCurrency`. */
  amountUnitLabel: string;
  paymentMethod: string;
  onPaymentMethodChange: (code: string) => void;
  onRefreshOffers: () => void;
  loading?: boolean;
  offerSort: OfferSortMode;
  onOfferSortChange: (mode: OfferSortMode) => void;
  listViewMode: P2pListViewMode;
  onListViewModeChange: (m: P2pListViewMode) => void;
  hasActiveOrder?: boolean;
  onOpenActiveTrade?: () => void;
};

function useDismissOnOutside(open: DropdownKey | null, setOpen: (k: DropdownKey | null) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open === null) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, setOpen]);
  return ref;
}

function MenuPanel({
  children,
  align = "start",
  alignMobile,
}: {
  children: React.ReactNode;
  /** Desktop alignment (sm+). Defaults to "start". */
  align?: "start" | "end";
  /** Optional override for < sm so the menu stays inside the mobile viewport. */
  alignMobile?: "start" | "end";
}) {
  const mobile = alignMobile ?? align;
  const mobileClass = mobile === "end" ? "right-0 left-auto" : "left-0 right-auto";
  const desktopClass = align === "end" ? "sm:right-0 sm:left-auto" : "sm:left-0 sm:right-auto";

  return (
    <div
      role="listbox"
      className={`absolute top-[calc(100%+6px)] z-[120] max-h-[min(320px,50dvh)] w-[min(15rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-white/[0.1] bg-[#0c1018] py-1.5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.85)] backdrop-blur-md [&::-webkit-scrollbar]:w-1.5 ${mobileClass} ${desktopClass}`}
    >
      {children}
    </div>
  );
}

export function P2pMarketToolbar({
  tab,
  onTabChange,
  asset,
  onAssetChange,
  amount,
  onAmountChange,
  fiatCurrency,
  onFiatCurrencyChange,
  amountUnitLabel,
  paymentMethod,
  onPaymentMethodChange,
  onRefreshOffers,
  loading,
  offerSort,
  onOfferSortChange,
  listViewMode,
  onListViewModeChange,
  hasActiveOrder = false,
  onOpenActiveTrade,
}: P2pMarketToolbarProps) {
  const [openMenu, setOpenMenu] = useState<DropdownKey | null>(null);
  const rootRef = useDismissOnOutside(openMenu, setOpenMenu);
  const payLabel =
    paymentMethod.trim() !== ""
      ? (P2P_PAYMENT_METHOD_OPTIONS.find((x) => x.code === paymentMethod)?.label ?? "Method")
      : "All methods";

  const amtId = useId();

  return (
    <div
      ref={rootRef}
      className="isolate border-b border-[#D4AF37]/12 bg-transparent"
    >
      <div className="overflow-visible">
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 max-md:gap-1.5 sm:gap-2.5 sm:px-6 sm:py-2.5 lg:flex-nowrap lg:gap-3">
          <div
            className="flex shrink-0 items-center rounded-xl border border-white/[0.08] bg-black/35 p-0.5 shadow-inner"
            role="tablist"
            aria-label="Buy or sell"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "buy"}
              className={`flex min-h-[42px] min-w-[4.5rem] items-center justify-center gap-1 rounded-[10px] px-2.5 text-[12px] font-bold uppercase tracking-wide transition touch-manipulation sm:min-w-[5.75rem] sm:px-3 ${
                tab === "buy"
                  ? "bg-emerald-600 text-white shadow-[0_0_20px_-4px_rgba(52,211,153,0.55)] ring-1 ring-emerald-400/40"
                  : "bg-transparent text-zinc-400 hover:bg-emerald-600/15 hover:text-emerald-200"
              }`}
              onClick={() => {
                setOpenMenu(null);
                onTabChange("buy");
              }}
            >
              Buy
              <ArrowDown className="h-4 w-4 opacity-95" aria-hidden />
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "sell"}
              className={`flex min-h-[42px] min-w-[4.5rem] items-center justify-center gap-1 rounded-[10px] px-2.5 text-[12px] font-bold uppercase tracking-wide transition touch-manipulation sm:min-w-[5.75rem] sm:px-3 ${
                tab === "sell"
                  ? "bg-red-600 text-white shadow-[0_0_20px_-4px_rgba(248,113,113,0.45)] ring-1 ring-red-400/40"
                  : "bg-zinc-800/55 text-zinc-400 hover:bg-red-500/25 hover:text-red-50 hover:ring-1 hover:ring-red-500/35 focus-visible:bg-red-500/20 focus-visible:text-red-50 active:bg-red-600/85 active:text-white"
              }`}
              onClick={() => {
                setOpenMenu(null);
                onTabChange("sell");
              }}
            >
              Sell
              <ArrowUp className="h-4 w-4 opacity-95" aria-hidden />
            </button>
          </div>

          <div
            className={`relative shrink-0 ${openMenu === "asset" ? "z-[110]" : ""}`}
          >
            <button
              type="button"
              className="flex min-h-[38px] min-w-[6.25rem] items-center justify-between gap-1 rounded-xl border border-white/[0.1] bg-black/35 px-2 py-1.5 text-left text-[11px] font-semibold text-[#F5E6B3] ring-1 ring-white/[0.04] hover:border-[#D4AF37]/35 sm:min-h-[42px] sm:min-w-[10.5rem] sm:gap-2 sm:px-3 sm:py-2 sm:text-[12px]"
              aria-expanded={openMenu === "asset"}
              onClick={() => setOpenMenu((k) => (k === "asset" ? null : "asset"))}
            >
              <span className="truncate">{OFFER_ASSETS.find((x) => x.code === asset)?.label ?? asset}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-75" aria-hidden />
            </button>
            {openMenu === "asset" ? (
              <MenuPanel alignMobile="end">
                {OFFER_ASSETS.map((a) => (
                  <button
                    key={a.code}
                    type="button"
                    role="option"
                    aria-selected={asset === a.code}
                    className={`flex w-full items-center px-3 py-2.5 text-left text-[13px] transition hover:bg-white/[0.05] ${
                      asset === a.code ? "bg-emerald-500/10 text-emerald-200" : "text-zinc-200"
                    }`}
                    onClick={() => {
                      onAssetChange(a.code);
                      setOpenMenu(null);
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </MenuPanel>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <label htmlFor={amtId} className="sr-only">
              Amount in {amountUnitLabel}
            </label>
            <input
              id={amtId}
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder={amountUnitLabel === "USDT" ? "Amount" : `Amount (${amountUnitLabel})`}
              aria-label={`Trade amount in ${amountUnitLabel}`}
              className="h-[38px] w-[4.75rem] rounded-xl border border-white/[0.1] bg-black/35 px-2 text-[15px] font-semibold tabular-nums text-white outline-none placeholder:text-zinc-600 focus:border-[#D4AF37]/40 focus:ring-2 focus:ring-[#D4AF37]/22 sm:h-[42px] sm:w-[8rem] sm:px-3 sm:text-[13px]"
            />
            <span
              className="hidden h-[42px] min-w-[2.75rem] items-center justify-center rounded-xl border border-white/[0.08] bg-black/25 px-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400 sm:flex"
              aria-hidden
            >
              {amountUnitLabel}
            </span>
            <div className={`relative ${openMenu === "currency" ? "z-[110]" : ""}`}>
              <button
                type="button"
                className="flex h-[42px] min-w-[4.5rem] items-center justify-between gap-1 rounded-xl border border-white/[0.1] bg-black/35 px-2 py-2 text-[12px] font-semibold uppercase tracking-wide text-zinc-200 hover:border-[#D4AF37]/35 sm:min-w-[5.5rem] sm:px-2.5"
                aria-expanded={openMenu === "currency"}
                aria-label="Filter by fiat currency"
                onClick={() => setOpenMenu((k) => (k === "currency" ? null : "currency"))}
              >
                <span className="truncate">
                  {fiatCurrency ? `${getFiatCurrency(fiatCurrency).flag} ${fiatCurrency}` : "All"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-75" aria-hidden />
              </button>
              {openMenu === "currency" ? (
                <MenuPanel align="start">
                  <button
                    type="button"
                    className={`block w-full px-3 py-2 text-left text-[13px] hover:bg-white/[0.05] ${
                      fiatCurrency === "" ? "bg-[#D4AF37]/10 text-[#F5E6B3]" : "text-zinc-300"
                    }`}
                    onClick={() => {
                      onFiatCurrencyChange("");
                      setOpenMenu(null);
                    }}
                  >
                    All currencies
                  </button>
                  {FIAT_CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-white/[0.05] ${
                        fiatCurrency === c.code ? "bg-[#D4AF37]/10 text-[#F5E6B3]" : "text-zinc-300"
                      }`}
                      onClick={() => {
                        onFiatCurrencyChange(c.code);
                        setOpenMenu(null);
                      }}
                    >
                      <span aria-hidden>{c.flag}</span>
                      <span className="font-bold">{c.code}</span>
                      <span className="truncate text-[11px] text-zinc-500">{c.name}</span>
                    </button>
                  ))}
                </MenuPanel>
              ) : null}
            </div>
          </div>

          <div
            className={`relative min-w-[6.5rem] flex-1 sm:min-w-[13rem] lg:flex-none lg:max-w-[16rem] ${
              openMenu === "method" ? "z-[110]" : ""
            }`}
          >
            <button
              type="button"
              className="flex h-[42px] w-full items-center justify-between gap-2 rounded-xl border border-white/[0.1] bg-black/35 px-3 py-2 text-left text-[12px] font-medium text-zinc-200 hover:border-[#D4AF37]/35"
              aria-expanded={openMenu === "method"}
              onClick={() => setOpenMenu((k) => (k === "method" ? null : "method"))}
            >
              <span className="truncate">{payLabel}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-75" aria-hidden />
            </button>
            {openMenu === "method" ? (
              <MenuPanel alignMobile="end">
                <button
                  type="button"
                  className="block w-full px-3 py-2.5 text-left text-[13px] text-zinc-200 hover:bg-white/[0.05]"
                  onClick={() => {
                    onPaymentMethodChange("");
                    setOpenMenu(null);
                  }}
                >
                  All payment methods
                </button>
                {P2P_PAYMENT_METHOD_OPTIONS.map((o) => (
                  <button
                    key={o.code}
                    type="button"
                    className={`block w-full px-3 py-2 text-left text-[13px] hover:bg-white/[0.05] ${
                      paymentMethod === o.code ? "bg-[#D4AF37]/10 text-[#F5E6B3]" : "text-zinc-300"
                    }`}
                    onClick={() => {
                      onPaymentMethodChange(o.code);
                      setOpenMenu(null);
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </MenuPanel>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 ml-auto lg:ml-0">
            <div className={`relative shrink-0 ${openMenu === "sort" ? "z-[110]" : ""}`}>
              <button
                type="button"
                title="Sort offers"
                aria-label="Sort offers"
                aria-expanded={openMenu === "sort"}
                onClick={() => setOpenMenu((k) => (k === "sort" ? null : "sort"))}
                className="flex h-[38px] min-w-[4.75rem] items-center justify-between gap-1 rounded-xl border border-white/[0.1] bg-black/35 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-200 transition hover:border-[#D4AF37]/45 hover:text-[#F5E6B3] sm:h-[42px] sm:min-w-[5.5rem] sm:px-2.5 sm:text-[11px]"
              >
                <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]/90" aria-hidden />
                <span className="truncate text-[#F5E6B3]">{offerSortButtonLabel(offerSort)}</span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-75" aria-hidden />
              </button>
              {openMenu === "sort" ? (
                <MenuPanel align="end">
                  {OFFER_SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={offerSort === opt.value}
                      className={`block w-full px-3 py-2.5 text-left text-[13px] transition hover:bg-white/[0.05] ${
                        offerSort === opt.value ? "bg-[#D4AF37]/12 text-[#F5E6B3]" : "text-zinc-300"
                      }`}
                      onClick={() => {
                        onOfferSortChange(opt.value);
                        setOpenMenu(null);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </MenuPanel>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void onRefreshOffers()}
              disabled={loading}
              aria-label="Refresh offers"
              title="Refresh offers"
              className="flex h-[38px] min-w-[38px] items-center justify-center rounded-xl border border-[#D4AF37]/28 bg-black/35 px-2 text-[10px] font-bold uppercase tracking-wide text-[#D4AF37] transition hover:bg-[#D4AF37]/15 disabled:opacity-45 sm:h-[42px] sm:min-w-[42px] sm:min-w-0 sm:px-3 sm:text-[11px]"
            >
              <RefreshCcw
                className={`h-[18px] w-[18px] sm:hidden ${loading ? "animate-spin" : ""}`}
                aria-hidden
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <div className={`relative shrink-0 ${openMenu === "trades" ? "z-[110]" : ""}`}>
              <button
                type="button"
                className="flex h-[38px] min-w-[5.5rem] max-w-[10rem] items-center gap-1 rounded-xl border border-white/[0.1] bg-black/35 px-1.5 py-1 ring-1 ring-white/[0.04] hover:border-[#D4AF37]/35 sm:h-[42px] sm:min-w-[8.75rem] sm:max-w-[12.5rem] sm:gap-2 sm:px-2.5"
                aria-expanded={openMenu === "trades"}
                aria-label="Pick offers or trades list"
                onClick={() => setOpenMenu((k) => (k === "trades" ? null : "trades"))}
              >
                <ClipboardList className="h-4 w-4 shrink-0 text-[#D4AF37]/85" aria-hidden />
                <span className="min-w-0 flex-1 text-left leading-[1.1]">
                  <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Trades</span>
                  <span className="mt-0.5 block truncate text-[12px] font-semibold tabular-nums text-[#F5E6B3]">
                    {listViewMode === "offers" ? "Offers" : tradesMenuLabel(listViewMode)}
                  </span>
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
              </button>
              {openMenu === "trades" ? (
                <MenuPanel align="end">
                  {LIST_VIEW_ROWS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      className={`block w-full px-3 py-2.5 text-left text-[13px] hover:bg-white/[0.05] ${
                        listViewMode === value ? "bg-[#D4AF37]/12 text-[#F5E6B3]" : "text-zinc-300"
                      }`}
                      onClick={() => {
                        onListViewModeChange(value);
                        setOpenMenu(null);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </MenuPanel>
              ) : null}
            </div>
            {hasActiveOrder && onOpenActiveTrade ? (
              <button
                type="button"
                onClick={onOpenActiveTrade}
                className="flex h-[42px] items-center rounded-xl border border-emerald-400/35 bg-emerald-600/20 px-3 text-[11px] font-bold uppercase tracking-wide text-emerald-100 transition hover:bg-emerald-600/30"
              >
                Open active trade
              </button>
            ) : null}
          </div>
        </div>
      </div>

    </div>
  );
}
