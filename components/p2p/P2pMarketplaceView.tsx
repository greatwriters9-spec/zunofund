"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { InvestorMarketplaceActiveTrades } from "@/components/p2p/InvestorMarketplaceActiveTrades";
import { OfferCard, type OfferCardRow } from "@/components/p2p/OfferCard";
import { P2pOrderWorkspace } from "@/components/p2p/P2pOrderWorkspace";
import { P2pMarketplaceSidebar } from "@/components/p2p/P2pMarketplaceSidebar";
import type { P2pAssetCode, P2pMarketTab } from "@/components/p2p/p2pTypes";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

type P2pMarketplaceViewProps = {
  initialTab: P2pMarketTab;
  backHref: string;
  backLabel: string;
};

type BrowseSplit = "offers" | "active";

export function P2pMarketplaceView({ initialTab, backHref, backLabel }: P2pMarketplaceViewProps) {
  const supabase = useSupabase();
  const [tab, setTab] = useState<P2pMarketTab>(initialTab);
  const [asset, setAsset] = useState<P2pAssetCode>("USDT");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [offers, setOffers] = useState<OfferCardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [payoutInstructions, setPayoutInstructions] = useState("");
  const [btcUsd, setBtcUsd] = useState<number | null>(null);
  const [ethUsd, setEthUsd] = useState<number | null>(null);

  const [browseSplit, setBrowseSplit] = useState<BrowseSplit>("offers");
  const [liveOrderId, setLiveOrderId] = useState<string | null>(null);
  const [activeTradesGen, setActiveTradesGen] = useState(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const rpcSide = tab === "buy" ? "sell_usdt" : "buy_usdt";

  const bumpActiveTrades = useCallback(() => {
    setActiveTradesGen((n) => n + 1);
  }, []);

  const focusOffersPane = useCallback(() => {
    setBrowseSplit("offers");
    setLiveOrderId(null);
  }, []);

  const focusActivePane = useCallback(() => {
    setBrowseSplit("active");
    setLiveOrderId(null);
  }, []);

  const jumpToActiveTrade = useCallback(() => {
    focusActivePane();
    bumpActiveTrades();
  }, [bumpActiveTrades, focusActivePane]);

  const exitLiveTradeToList = useCallback(() => {
    setLiveOrderId(null);
    setBrowseSplit("active");
    bumpActiveTrades();
  }, [bumpActiveTrades]);

  const openEmbeddedOrder = useCallback((orderId: string) => {
    setBrowseSplit("active");
    setLiveOrderId(orderId);
  }, []);

  useEffect(() => {
    setOffers([]);
    setError(null);
    setPayoutInstructions("");
  }, [tab]);

  useEffect(() => {
    if (asset !== "USDT") {
      setOffers([]);
      setError(null);
    }
  }, [asset]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/market/spot", { cache: "no-store" });
        const json = (await res.json()) as { btcUsd?: unknown; ethUsd?: unknown };
        if (cancelled) return;
        setBtcUsd(typeof json.btcUsd === "number" ? json.btcUsd : null);
        setEthUsd(typeof json.ethUsd === "number" ? json.ethUsd : null);
      } catch {
        if (!cancelled) {
          setBtcUsd(null);
          setEthUsd(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const search = useCallback(async () => {
    setError(null);
    if (asset !== "USDT") {
      setOffers([]);
      setError("P2P listings are available for USDT only right now. BTC and ETH are coming soon.");
      return;
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setOffers([]);
      setError("Enter a valid USDT amount.");
      return;
    }

    setLoading(true);
    const { data, error: rpcErr } = await supabase.rpc("investor_search_merchant_offers", {
      p_side: rpcSide,
      p_amount: amt,
      p_payment_method: method.trim() || null,
    });
    setLoading(false);

    if (rpcErr) {
      setError(formatSupabaseError(rpcErr));
      setOffers([]);
      return;
    }

    setOffers((data as OfferCardRow[]) ?? []);
  }, [amount, asset, method, rpcSide, supabase]);

  async function pickOffer(row: OfferCardRow) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;

    if (tab === "sell") {
      const instr = payoutInstructions.trim();
      if (!instr) {
        setError("Add your payout instructions so the merchant knows where to send fiat.");
        return;
      }
    }

    setBusyOfferId(row.offer_id);
    setError(null);

    const pm = method.trim() || row.payment_methods[0] || "";

    if (tab === "buy") {
      const { data: oid, error: e } = await supabase.rpc("investor_create_merchant_buy_order", {
        p_offer_id: row.offer_id,
        p_amount_requested: amt,
        p_payment_method: pm,
      });
      setBusyOfferId(null);
      if (e) {
        setError(formatSupabaseError(e));
        return;
      }
      openEmbeddedOrder(String(oid));
      bumpActiveTrades();
      return;
    }

    const { data: oid, error: e } = await supabase.rpc("investor_create_merchant_sell_order", {
      p_offer_id: row.offer_id,
      p_usdt_amount: amt,
      p_payment_method: pm,
      p_investor_payout_instructions: payoutInstructions.trim(),
    });
    setBusyOfferId(null);
    if (e) {
      setError(formatSupabaseError(e));
      return;
    }
    openEmbeddedOrder(String(oid));
    bumpActiveTrades();
  }

  const amtNum = Number(amount);

  const paneTabClass = (pressed: boolean) =>
    `relative min-h-[44px] flex-1 rounded-xl border px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] transition sm:min-w-[10.5rem] sm:flex-none sm:py-3 sm:text-[12px] touch-manipulation ${
      pressed
        ? "border-[#D4AF37]/55 bg-black/55 text-[#F5E6B3] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-emerald-500/20"
        : "border-white/12 bg-black/28 text-zinc-500 hover:border-[#D4AF37]/30 hover:text-zinc-300"
    }`;

  const offersHighlighted = browseSplit === "offers" && liveOrderId == null;
  const activeHighlighted = browseSplit === "active" || liveOrderId != null;

  const subtitle = liveOrderId
    ? "Live trade — settle in place. Back returns to active trades."
    : browseSplit === "active"
      ? "Trades awaiting payment or settlement — tap a ticket to continue."
      : tab === "buy"
        ? "Buy USDT from merchants"
        : "Sell USDT to merchants";

  const sidebarProps = {
    tab,
    onTabChange: setTab,
    asset,
    onAssetChange: setAsset,
    amount,
    onAmountChange: setAmount,
    paymentMethod: method,
    onPaymentMethodChange: setMethod,
    onSearch: () => void search(),
    loading,
    sellPayoutValue: payoutInstructions,
    onSellPayoutChange: setPayoutInstructions,
    onOpenActiveTrades: jumpToActiveTrade,
  } as const;

  return (
    <div className="relative flex min-h-[100dvh] min-w-0 flex-col bg-[#03060c] pb-[max(0.5rem,env(safe-area-inset-bottom))] text-white lg:flex-row">
      <div className="sticky top-0 z-40 border-b border-[#D4AF37]/15 bg-[#05080F]/96 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
          aria-expanded={mobileFiltersOpen}
          onClick={() => setMobileFiltersOpen((o) => !o)}
        >
          <span>
            <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#D4AF37]/90">
              Search &amp; filters
            </span>
            <span className="mt-0.5 block text-[12px] text-zinc-500">
              {asset} · {tab === "buy" ? "Buy" : "Sell"} · amount &amp; pay rail
            </span>
          </span>
          <ChevronDown
            className={`h-6 w-6 shrink-0 text-[#D4AF37] transition-transform duration-200 ${mobileFiltersOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {mobileFiltersOpen ? (
          <div className="max-h-[min(72dvh,520px)] overflow-y-auto overscroll-y-contain border-t border-white/10 px-4 pb-4 pt-3 [scrollbar-width:thin]">
            <P2pMarketplaceSidebar {...sidebarProps} />
          </div>
        ) : (
          <p className="border-t border-white/5 px-4 py-3 text-center text-[11px] leading-snug text-zinc-500">
            Expand to set amount, rail, payout (sell), and load offers — then browse below.
          </p>
        )}
      </div>

      <div className="hidden shrink-0 lg:block">
        <P2pMarketplaceSidebar {...sidebarProps} />
      </div>

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:min-h-screen">
        <div className="border-b border-[#D4AF37]/10 bg-black/20 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link href={backHref} className="text-sm font-medium text-[#D4AF37] transition hover:text-[#F5E6B3]">
                ← {backLabel}
              </Link>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                <span className="text-[#D4AF37]">P2P</span> marketplace
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {subtitle}
                {asset !== "USDT" && browseSplit === "offers" && !liveOrderId ? (
                  <>
                    {" "}
                    <span className="text-zinc-600">• {asset} coming soon</span>
                  </>
                ) : null}
              </p>
            </div>
            <Link
              href="/dashboard"
              className="shrink-0 rounded-xl border border-[#D4AF37]/30 bg-black/30 px-4 py-2 text-sm font-medium text-[#F5E6B3] backdrop-blur-sm transition hover:border-[#D4AF37]/50 hover:bg-black/45"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden px-4 pb-8 pt-5 sm:px-6">
          {error ? (
            <div className="mb-4 rounded-2xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="mb-4 flex w-full flex-row gap-2 sm:items-center sm:gap-3 md:flex-wrap" role="tablist" aria-label="Marketplace content">
            <button
              type="button"
              role="tab"
              aria-selected={offersHighlighted}
              className={paneTabClass(offersHighlighted)}
              onClick={() => focusOffersPane()}
            >
              Available offers
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeHighlighted}
              className={paneTabClass(activeHighlighted)}
              onClick={() => focusActivePane()}
            >
              Active trades
            </button>
          </div>

          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            {liveOrderId ? (
              <div className="max-h-[min(70dvh,calc(100dvh-11rem))] overflow-y-auto pr-1 pb-2 lg:max-h-[min(78vh,calc(100vh-12rem))] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2">
                <P2pOrderWorkspace
                  embedded
                  orderId={liveOrderId}
                  onBack={exitLiveTradeToList}
                  backLabel="← Active trades"
                />
              </div>
            ) : browseSplit === "active" ? (
              <div className="max-h-[min(65dvh,calc(100dvh-12rem))] overflow-y-auto pr-1 pb-2 lg:max-h-[min(70vh,calc(100vh-12rem))] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2">
                <InvestorMarketplaceActiveTrades refreshKey={activeTradesGen} onOpenOrder={openEmbeddedOrder} />
              </div>
            ) : asset !== "USDT" ? (
              <div className="rounded-2xl border border-dashed border-[#D4AF37]/25 bg-black/25 px-6 py-16 text-center backdrop-blur-sm">
                <p className="text-zinc-400">
                  {asset} P2P is not live yet. Select <strong className="text-[#D4AF37]">USDT</strong> in the filters
                  strip (expand at top on mobile · rail on desktop).
                </p>
              </div>
            ) : loading ? (
              <div className="flex max-h-[min(65dvh,calc(100dvh-12rem))] flex-col gap-4 overflow-y-auto pr-1 pb-2 lg:max-h-[min(70vh,calc(100vh-12rem))] [scrollbar-width:thin]">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-[5.75rem] w-full shrink-0 animate-pulse rounded-xl bg-emerald-500/[0.04] ring-1 ring-emerald-500/15"
                  />
                ))}
              </div>
            ) : offers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#D4AF37]/25 bg-black/25 px-6 py-16 text-center backdrop-blur-sm">
                <p className="text-zinc-400">
                  No matching offers yet. Expand <strong className="text-[#D4AF37]">Search &amp; filters</strong>, set
                  amount and pay method, then tap <strong className="text-[#D4AF37]">Search offers</strong>.
                </p>
              </div>
            ) : (
              <div className="flex max-h-[min(65dvh,calc(100dvh-12rem))] flex-col gap-4 overflow-y-auto pr-1 pb-2 lg:max-h-[min(70vh,calc(100vh-12rem))] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2">
                {offers.map((row) => (
                  <OfferCard
                    key={row.offer_id}
                    row={row}
                    flow={tab}
                    amountUsdt={amtNum}
                    busy={busyOfferId === row.offer_id}
                    onTrade={() => void pickOffer(row)}
                    btcUsd={btcUsd}
                    ethUsd={ethUsd}
                  />
                ))}
              </div>
            )}
          </div>

          {!liveOrderId ? (
            <p className="mt-8 text-center text-xs text-zinc-600">
              <Link href="/p2p" className="text-[#D4AF37] hover:text-[#F5E6B3] hover:underline">
                Marketplace home
              </Link>
              {" · "}
              <Link href="/p2p/history" className="text-[#D4AF37] hover:text-[#F5E6B3] hover:underline">
                Full trade history
              </Link>
              {" · "}
              <Link href="/merchant" className="text-[#D4AF37] hover:text-[#F5E6B3] hover:underline">
                Merchant dashboard
              </Link>
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}