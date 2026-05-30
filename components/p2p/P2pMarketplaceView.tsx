"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { InvestorMarketplaceActiveTrades } from "@/components/p2p/InvestorMarketplaceActiveTrades";
import { OffersScrollList } from "@/components/p2p/OffersScrollList";
import { OfferCard, type OfferCardRow } from "@/components/p2p/OfferCard";
import type { P2pListViewMode } from "@/components/p2p/P2pMarketToolbar";
import { P2pMarketToolbar } from "@/components/p2p/P2pMarketToolbar";
import { resolveTradeAmount } from "@/components/p2p/resolveTradeAmount";
import type { P2pAssetCode, P2pMarketTab } from "@/components/p2p/p2pTypes";
import { expireStaleP2pOrders, isP2pOrderActive } from "@/lib/p2pExpiry";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";
import { isFiatCurrencyCode, type FiatCurrencyCode } from "@/lib/currencies";
import { assetFromOfferSide, formatLimitRange, minAmountPlaceholder, p2pOfferSide } from "@/lib/p2pAssets";
import { inputToOfferFiat } from "@/lib/p2pValue";
import { getFxRates, useFxRates } from "@/lib/useFx";



type P2pMarketplaceViewProps = {
  initialTab: P2pMarketTab;
  backHref: string;
  backLabel: string;
};

export function P2pMarketplaceView({ initialTab, backHref, backLabel }: P2pMarketplaceViewProps) {
  const router = useRouter();
  const supabase = useSupabase();
  const [tab, setTab] = useState<P2pMarketTab>(initialTab);
  const [asset, setAsset] = useState<P2pAssetCode>("USDT");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [fiatCurrency, setFiatCurrency] = useState<FiatCurrencyCode | "">("");
  const [offersRaw, setOffersRaw] = useState<OfferCardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);

  const [listViewMode, setListViewMode] = useState<P2pListViewMode>("offers");
  const [activeTradesGen, setActiveTradesGen] = useState(0);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [feeCapInput, setFeeCapInput] = useState("");
  const [sizeFloorInput, setSizeFloorInput] = useState("");

  const [amountPromptRow, setAmountPromptRow] = useState<OfferCardRow | null>(null);
  const [amountPromptValue, setAmountPromptValue] = useState("");
  const [amountPromptError, setAmountPromptError] = useState<string | null>(null);
  const [merchantActive, setMerchantActive] = useState(false);

  useEffect(() => {
    async function loadMerchantAccess() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setMerchantActive(false);
        return;
      }
      const { data } = await supabase
        .from("merchant_profiles")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      setMerchantActive((data as { status?: string } | null)?.status === "active");
    }
    void loadMerchantAccess();
  }, [supabase]);

  const rpcSide = p2pOfferSide(tab, asset);
  const { rates: fxRates } = useFxRates();
  const amountUnit = fiatCurrency || asset;

  const resolveOpts = useMemo(
    () => ({ inputCurrency: amountUnit, asset, rates: fxRates }),
    [amountUnit, asset, fxRates],
  );

  const bumpActiveTrades = useCallback(() => {
    setActiveTradesGen((n) => n + 1);
  }, []);

  const loadActiveOrder = useCallback(async () => {
    await expireStaleP2pOrders(supabase);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setActiveOrderId(null);
      return;
    }

    const { data, error: qErr } = await supabase
      .from("merchant_orders")
      .select("id, status, expires_at, created_at")
      .or(`investor_user_id.eq.${user.id},merchant_user_id.eq.${user.id}`)
      .in("status", ["pending_payment", "paid", "disputed"])
      .order("created_at", { ascending: false })
      .limit(25);

    if (qErr) {
      setActiveOrderId(null);
      return;
    }

    const rows = ((data ?? []) as Array<{
      id: string;
      status: string;
      expires_at: string | null;
    }>).filter((r) => isP2pOrderActive(r.status, r.expires_at));

    setActiveOrderId(rows[0]?.id ?? null);
  }, [supabase]);

  const handleListViewModeChange = useCallback(
    (m: P2pListViewMode) => {
      setListViewMode(m);
      if (m !== "offers") bumpActiveTrades();
    },
    [bumpActiveTrades],
  );

  const filterBadgeCount = [feeCapInput.trim(), sizeFloorInput.trim()].filter((s) => s !== "").length;

  useEffect(() => {
    setError(null);
  }, [tab]);

  const fetchOffers = useCallback(async () => {
    setError(null);

    setLoading(true);
    const parsedAmt = Number(amount);
    const searchAmount =
      Number.isFinite(parsedAmt) && parsedAmt > 0 ? parsedAmt : null;
    const { data, error: rpcErr } = await supabase.rpc("investor_search_merchant_offers", {
      p_side: rpcSide,
      p_amount: searchAmount,
      p_payment_method: method.trim() ? method.trim() : null,
      p_fiat_currency_code: fiatCurrency || null,
      p_amount_currency: searchAmount != null ? amountUnit : null,
    });
    setLoading(false);

    if (rpcErr) {
      setError(formatSupabaseError(rpcErr));
      setOffersRaw([]);
      return;
    }

    setOffersRaw((data as OfferCardRow[]) ?? []);
  }, [amount, amountUnit, method, fiatCurrency, rpcSide, supabase]);

  useEffect(() => {
    void fetchOffers();
  }, [fetchOffers, asset, tab]);

  useEffect(() => {
    void loadActiveOrder();
  }, [loadActiveOrder, activeTradesGen]);

  useEffect(() => {
    if (!activeOrderId) return;
    setListViewMode((prev) => (prev === "offers" ? "active" : prev));
  }, [activeOrderId]);

  const toolbarAmount = useMemo(() => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }, [amount]);

  const offersDisplayed = useMemo(() => {
    let list = offersRaw;
    if (toolbarAmount != null) {
      list = list.filter((o) => {
        const offerFiat = (o.fiat_currency_code || "USD").toUpperCase();
        const fiatAmt = inputToOfferFiat(toolbarAmount, amountUnit, offerFiat, fxRates);
        return fiatAmt >= Number(o.min_limit) && fiatAmt <= Number(o.max_limit);
      });
    }
    const cap = Number(feeCapInput);
    if (feeCapInput.trim() !== "" && Number.isFinite(cap) && cap >= 0) {
      list = list.filter((o) => Number(o.rate_percentage) <= cap);
    }
    const floor = Number(sizeFloorInput);
    if (sizeFloorInput.trim() !== "" && Number.isFinite(floor) && floor > 0) {
      list = list.filter((o) => Number(o.max_limit) >= floor);
    }
    return [...list].sort(
      (a, b) => Number(a.rate_percentage) - Number(b.rate_percentage),
    );
  }, [offersRaw, toolbarAmount, amountUnit, fxRates, feeCapInput, sizeFloorInput]);

  async function executeOrder(row: OfferCardRow, fiatAmt: number) {
    setBusyOfferId(row.offer_id);
    setError(null);

    const pm = method.trim() || row.payment_methods[0] || "";
    if (!pm) {
      setBusyOfferId(null);
      setError("Pick a payment method in the toolbar, or choose an ad that lists your rail.");
      return;
    }

    // Snapshot the rate the investor is looking at right now so it's the same
    // number stored on the order row. The RPC has its own fallback, but
    // sending the visible rate guarantees no drift between UI and DB.
    const offerCcy = row.fiat_currency_code || "USD";
    const fxRates = await getFxRates();
    const lockedRate =
      offerCcy === "USD"
        ? 1
        : Number.isFinite(fxRates[offerCcy]) && fxRates[offerCcy] > 0
          ? fxRates[offerCcy]
          : null;

    if (tab === "buy") {
      const { data: oid, error: e } = await supabase.rpc("investor_create_merchant_buy_order", {
        p_offer_id: row.offer_id,
        p_fiat_amount: fiatAmt,
        p_payment_method: pm,
        p_fx_rate_usd_at_open: lockedRate,
      });
      setBusyOfferId(null);
      if (e) {
        setError(formatSupabaseError(e));
        return;
      }
      router.push(`/p2p/order/${String(oid)}`);
      bumpActiveTrades();
      return;
    }

    const { data: oid, error: e } = await supabase.rpc("investor_create_merchant_sell_order", {
      p_offer_id: row.offer_id,
      p_fiat_amount: fiatAmt,
      p_payment_method: pm,
      p_investor_payout_instructions: null,
      p_fx_rate_usd_at_open: lockedRate,
    });
    setBusyOfferId(null);
    if (e) {
      setError(formatSupabaseError(e));
      return;
    }
    router.push(`/p2p/order/${String(oid)}`);
    bumpActiveTrades();
  }

  async function pickOffer(row: OfferCardRow) {
    const trimmed = amount.trim();
    if (!trimmed) {
      setAmountPromptRow(row);
      setAmountPromptValue("");
      setAmountPromptError(null);
      return;
    }

    const { fiatAmount, error: amtErr } = resolveTradeAmount(row, amount, resolveOpts);
    if (amtErr) {
      setError(amtErr);
      return;
    }

    await executeOrder(row, fiatAmount);
  }

  function confirmAmountPrompt() {
    const row = amountPromptRow;
    if (!row) return;
    const promptFiat = (row.fiat_currency_code || "USD").toUpperCase();
    const { fiatAmount, error: amtErr } = resolveTradeAmount(row, amountPromptValue, {
      inputCurrency: promptFiat,
      asset,
      rates: fxRates,
    });
    if (amtErr) {
      setAmountPromptError(amtErr);
      return;
    }
    if (isFiatCurrencyCode(promptFiat)) {
      setFiatCurrency(promptFiat);
    }
    setAmount(amountPromptValue.trim());
    setAmountPromptRow(null);
    setAmountPromptError(null);
    void executeOrder(row, fiatAmount);
  }

  function closeAmountPrompt() {
    setAmountPromptRow(null);
    setAmountPromptError(null);
    setAmountPromptValue("");
  }

  const amtNum = toolbarAmount ?? 0;

  const subtitle =
    listViewMode === "active"
      ? "Tickets awaiting fiat or escrow release."
      : listViewMode === "completed"
        ? "Past P2P tickets — tap to reopen the transcript."
        : listViewMode === "cancelled"
          ? "Closed tickets — reopen for context anytime."
            : tab === "buy"
            ? `Tap Buy ${asset} to open chat — add amount here to filter, or we use each ad’s minimum.`
            : `Tap Sell ${asset} to open chat — share your payout details in the trade thread.`;


  return (
    <div className="relative flex min-h-[100dvh] min-w-0 flex-col bg-[#03060c] pb-[max(0.5rem,env(safe-area-inset-bottom))] text-white">
      <main className="relative flex min-w-0 flex-1 flex-col">
        <div className="relative z-50 shrink-0 border-b border-[#D4AF37]/10 bg-black/20 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pb-4 sm:pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 sm:pb-0">
            <div className="min-w-0">
              <Link href={backHref} className="text-sm font-medium text-[#D4AF37] transition hover:text-[#F5E6B3]">
                ← {backLabel}
              </Link>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                <span className="text-emerald-500">Buy</span> / <span className="text-zinc-600">sell</span>{" "}
                <span className="text-[#D4AF37]">crypto</span>
              </h1>
              <p className="mt-1 max-w-xl text-sm text-zinc-500">
                {subtitle}
              </p>
            </div>
            <Link
              href="/dashboard"
              className="shrink-0 rounded-xl border border-[#D4AF37]/30 bg-black/30 px-4 py-2 text-sm font-medium text-[#F5E6B3] backdrop-blur-sm transition hover:border-[#D4AF37]/50 hover:bg-black/45"
            >
              Dashboard
            </Link>
          </div>

          <P2pMarketToolbar
            tab={tab}
            onTabChange={(t) => {
              setTab(t);
              setListViewMode("offers");
            }}
            asset={asset}
            onAssetChange={(a) => {
              setAsset(a);
              setListViewMode("offers");
            }}
            amount={amount}
            onAmountChange={(v) => setAmount(v)}
            fiatCurrency={fiatCurrency}
            onFiatCurrencyChange={(c) => {
              setFiatCurrency(c);
              setAmount("");
              setListViewMode("offers");
            }}
            amountUnitLabel={amountUnit}
            paymentMethod={method}
            onPaymentMethodChange={(c) => {
              setMethod(c);
              setListViewMode("offers");
            }}
            onRefreshOffers={() => {
              void fetchOffers();
              if (listViewMode !== "offers") bumpActiveTrades();
            }}
            loading={loading}
            filterBadgeCount={filterBadgeCount}
            onOpenAdvancedFilters={() => setFiltersOpen(true)}
            listViewMode={listViewMode}
            onListViewModeChange={handleListViewModeChange}
            hasActiveOrder={Boolean(activeOrderId)}
            onOpenActiveTrade={() => {
              if (!activeOrderId) return;
              router.push(`/p2p/order/${activeOrderId}`);
            }}
          />
        </div>

        <div className="relative z-0 flex min-w-0 flex-1 flex-col px-4 pb-6 pt-5 sm:px-6">
          {error ? (
            <div className="mb-4 rounded-2xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="min-w-0 flex-1 pt-2">
            {listViewMode !== "offers" ? (
              <div className="overflow-y-auto pr-1 pb-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2">
                <InvestorMarketplaceActiveTrades
                  bucket={listViewMode}
                  refreshKey={activeTradesGen}
                  onOpenOrder={(oid) => router.push(`/p2p/order/${oid}`)}
                />
              </div>
            ) : loading ? (
              <div className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-black/25">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 w-full animate-pulse border-b border-white/[0.06] bg-white/[0.02] last:border-0" />
                ))}
              </div>
            )             : offersDisplayed.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#D4AF37]/25 bg-black/25 px-6 py-16 text-center backdrop-blur-sm">
                <p className="text-zinc-400">
                  {offersRaw.length === 0
                    ? "No live ads on this side yet. Try Refresh, switch Buy/Sell, or pick another payment method."
                    : "No ads match your size or filters right now."}
                  {filterBadgeCount > 0 ? " Try clearing advanced filters." : null}
                  {offersRaw.length > 0 && toolbarAmount != null ? (
                    <span className="block mt-2 text-zinc-500">
                      Widen your amount or change payment method — listings update as you adjust the toolbar.
                    </span>
                  ) : null}
                </p>
              </div>
            ) : (
              <OffersScrollList>
                {offersDisplayed.map((row) => (
                  <OfferCard
                    key={row.offer_id}
                    row={row}
                    flow={tab}
                    toolbarAmount={amtNum}
                    inputCurrency={amountUnit}
                    asset={asset}
                    busy={busyOfferId === row.offer_id}
                    onTrade={() => void pickOffer(row)}
                  />
                ))}
              </OffersScrollList>
            )}
          </div>

          <details className="group mt-10 rounded-xl border border-white/[0.08] bg-black/35 px-4 py-3 text-sm text-zinc-400 lg:hidden [&_summary::-webkit-details-marker]:hidden">
            <summary className="cursor-pointer list-none py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]/90">
              How Zuno P2P works<span className="ml-2 text-zinc-500 group-open:hidden">(+)</span>
              <span className="ml-2 hidden text-zinc-500 group-open:inline">(-)</span>
            </summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[12px] leading-relaxed text-zinc-500">
              <li>Pick Buy or Sell — filters stay pinned to the toolbar.</li>
              <li>Preview pay/receive columns per advert; fiat clears off-platform inside your rail.</li>
              <li>Opening Buy/Sell routes you to full-screen chat escrow with Mark as Paid &amp; release steps.</li>
              <li>Use only on-platform escrow + verified instructions — beware out-of-band account swaps.</li>
            </ol>
          </details>

          <div className="mt-10 hidden lg:block lg:rounded-xl lg:border lg:border-white/[0.08] lg:bg-black/30 lg:p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#D4AF37]/90">How Zuno P2P works</h3>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-[12px] leading-relaxed text-zinc-500">
              <li>Everything you need stays in one top strip.</li>
              <li>Listings consolidate into one block so scanning feels Paxful-clean.</li>
              <li>Tickets open fullscreen with trade summary, reminders, and chat.</li>
              <li>Completed tickets roll into history automatically.</li>
            </ol>
          </div>

          <p className="mt-8 text-center text-xs text-zinc-600">
            <Link href="/p2p" className="text-[#D4AF37] hover:text-[#F5E6B3] hover:underline">
              Marketplace home
            </Link>
            {" · "}
            <Link href="/p2p/history" className="text-[#D4AF37] hover:text-[#F5E6B3] hover:underline">
              Full trade history
            </Link>
            {merchantActive ? (
              <>
                {" · "}
                <Link href="/merchant" className="text-[#D4AF37] hover:text-[#F5E6B3] hover:underline">
                  Merchant dashboard
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </main>

      {filtersOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="p2p-filter-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#D4AF37]/25 bg-[#080c14] p-6 shadow-2xl">
            <h2 id="p2p-filter-title" className="text-lg font-bold text-white">
              Offer filters
            </h2>
            <p className="mt-2 text-xs text-zinc-500">
              Applies on top of toolbar results — narrow by merchant fee tier or liquidity overlap.
            </p>
            <label className="mt-6 block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Maximum merchant fee %</span>
              <input
                type="number"
                inputMode="decimal"
                value={feeCapInput}
                onChange={(e) => setFeeCapInput(e.target.value)}
                placeholder="e.g. 2.5"
                className="mt-2 w-full rounded-xl border border-white/12 bg-black/45 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#D4AF37]/45 focus:ring-2 focus:ring-[#D4AF37]/20"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Minimum liquidity (their max ≥)</span>
              <input
                type="number"
                inputMode="decimal"
                value={sizeFloorInput}
                onChange={(e) => setSizeFloorInput(e.target.value)}
                placeholder="USDT notionally"
                className="mt-2 w-full rounded-xl border border-white/12 bg-black/45 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#D4AF37]/45 focus:ring-2 focus:ring-[#D4AF37]/20"
              />
            </label>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl border border-white/14 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.04]"
                onClick={() => {
                  setFeeCapInput("");
                  setSizeFloorInput("");
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
                onClick={() => setFiltersOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {amountPromptRow ? (() => {
        const promptFiat = (amountPromptRow.fiat_currency_code || "USD").toUpperCase();
        const promptMinFiat = Number(amountPromptRow.min_limit);
        const promptMaxFiat = Number(amountPromptRow.max_limit);
        const limitsLine = `Limits ${formatLimitRange(promptMinFiat, promptMaxFiat, promptFiat, asset, promptFiat, fxRates)}`;
        const placeholderVal = minAmountPlaceholder(promptMinFiat, promptFiat);

        return (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 px-0 pb-0 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-0"
          role="dialog"
          aria-modal="true"
          aria-labelledby="amount-prompt-title"
          onClick={closeAmountPrompt}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl border border-[#D4AF37]/20 bg-[#0a0f1a] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-30px_80px_-20px_rgba(0,0,0,0.8)] sm:rounded-2xl sm:pb-6 sm:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 sm:hidden"
              aria-hidden
            />
            <h3 id="amount-prompt-title" className="text-base font-bold text-white">
              Choose an amount
            </h3>
            <p className="mt-1 text-[12px] text-zinc-400">
              How much do you want to {tab === "buy" ? "buy" : "sell"} from{" "}
              <span className="font-semibold text-[#F5E6B3]">
                {amountPromptRow.merchant_display_name}
              </span>{" "}
              in <span className="font-semibold text-[#F5E6B3]">{promptFiat}</span>?
            </p>
            <p className="mt-2 text-[11px] tabular-nums text-zinc-500">{limitsLine}</p>

            <label className="mt-4 block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Amount ({promptFiat})
              </span>
              <input
                type="number"
                inputMode="decimal"
                autoFocus
                value={amountPromptValue}
                onChange={(e) => {
                  setAmountPromptValue(e.target.value);
                  if (amountPromptError) setAmountPromptError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmAmountPrompt();
                  }
                }}
                placeholder={placeholderVal}
                className="mt-2 w-full rounded-xl border border-white/12 bg-black/45 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#D4AF37]/45 focus:ring-2 focus:ring-[#D4AF37]/20"
              />
            </label>

            {amountPromptError ? (
              <p className="mt-3 rounded-md border border-red-500/35 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
                {amountPromptError}
              </p>
            ) : null}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={closeAmountPrompt}
                className="min-h-[44px] flex-1 rounded-xl border border-white/14 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.04]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAmountPrompt}
                disabled={busyOfferId === amountPromptRow.offer_id}
                className="min-h-[44px] flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {tab === "buy" ? `Buy ${asset}` : `Sell ${asset}`}
              </button>
            </div>
          </div>
        </div>
        );
      })() : null}
    </div>
  );
}
