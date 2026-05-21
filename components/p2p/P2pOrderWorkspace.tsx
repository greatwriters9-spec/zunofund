"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ChevronDown, Lock } from "lucide-react";

import { CancelModal } from "@/components/p2p/CancelModal";
import type { ChatMessage } from "@/components/p2p/TradeChat";
import { TradeChat } from "@/components/p2p/TradeChat";
import { TradeOrderBrief } from "@/components/p2p/TradeOrderBrief";
import {
  formatHMS,
  merchantInitials,
  orderStatusHeadline,
  paymentMethodLabel,
} from "@/components/p2p/utils";
import { deriveTradePanels } from "@/components/p2p/deriveTradePanels";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";
import { formatFiat } from "@/lib/currencies";
import { assetFromOfferSide, fmtAssetAmount } from "@/lib/p2pAssets";
import type { WorkspaceOrderRow } from "@/components/p2p/workspaceTypes";

export type { WorkspaceOrderRow } from "@/components/p2p/workspaceTypes";

export type P2pOrderWorkspaceProps = {
  orderId: string;
  /** When true, sizing fits the marketplace main column instead of standalone page padding. */
  embedded?: boolean;
  /** Prefer `onBack` for in-app flows; fallback is `Link` using `backHref`. */
  onBack?: () => void;
  backLabel?: string;
  /** Used when `onBack` is not provided (standalone order page). */
  backHref?: string;
};

type OrderMessageRow = {
  id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
};

const linkCls = "text-[13px] font-medium text-[#D4AF37] transition hover:text-[#F5E6B3]";

export function P2pOrderWorkspace({
  orderId: id,
  embedded = false,
  onBack,
  backLabel = "← Marketplace",
  backHref = "/p2p",
}: P2pOrderWorkspaceProps) {
  const supabase = useSupabase();

  const [userId, setUserId] = useState<string | null>(null);
  const [order, setOrder] = useState<WorkspaceOrderRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [serverMessages, setServerMessages] = useState<OrderMessageRow[]>([]);
  const [chatSyncError, setChatSyncError] = useState<string | null>(null);
  const [chatSending, setChatSending] = useState(false);
  const [merchantListingName, setMerchantListingName] = useState<string | null>(null);

  const tradePanelsDerived = useMemo(() => {
    if (!order) return null;
    const merchantView = userId !== null && order.merchant_user_id === userId;
    return deriveTradePanels(order, merchantView);
  }, [order, userId]);

  const chatDisplayMessages: ChatMessage[] = useMemo(
    () =>
      serverMessages.map((r) => ({
        id: r.id,
        kind: "user" as const,
        mine: Boolean(userId && r.sender_user_id === userId),
        body: r.body,
        at: new Date(r.created_at),
      })),
    [serverMessages, userId],
  );

  const tradeTimelineMessages = useMemo((): ChatMessage[] => {
    if (!order) return [];
    const isMerchView = Boolean(userId && order.merchant_user_id === userId);
    const anchor = order.created_at ? new Date(order.created_at) : new Date();

    const sys = (
      sid: string,
      body: string,
      tone: "default" | "success",
    ): ChatMessage => ({
      id: sid,
      kind: "system",
      systemTone: tone,
      hideTime: true,
      mine: false,
      body,
      at: anchor,
    });

    const out: ChatMessage[] = [];
    const st = order.status;

    if (st === "cancelled") {
      out.push(
        sys(
          "sys-cancelled",
          "Trade cancelled — do not send new funds unless you jointly coordinate here.",
          "default",
        ),
      );
      return out;
    }

    if (st === "paid" || st === "completed") {
      let paidBody: string;
      if (order.side === "sell_usdt" || order.side === "sell_btc") {
        paidBody = isMerchView
          ? "Buyer marked paid. Confirm fiat, then release when satisfied."
          : "Marked paid — merchant verifying.";
      } else {
        paidBody = isMerchView
          ? "Fiat payout marked sent; seller confirms before escrow release."
          : "Merchant marked payout sent — verify before releasing.";
      }
      out.push(sys("sys-milestone-paid", paidBody, "success"));
    }

    if (st === "completed") {
      out.push(sys("sys-milestone-complete", "Trade completed — balances refreshed.", "success"));
    }

    return out;
  }, [order, userId]);

  const combinedChatMessages = useMemo(
    () => [...tradeTimelineMessages, ...chatDisplayMessages],
    [tradeTimelineMessages, chatDisplayMessages],
  );

  const load = useCallback(async () => {
    if (!id?.trim()) return;
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const { data: ord, error: qErr } = await supabase
      .from("merchant_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    setLoading(false);

    if (qErr) {
      setError(formatSupabaseError(qErr));
      setOrder(null);
      setMerchantListingName(null);
      return;
    }

    if (!ord) {
      setOrder(null);
      setError(null);
      setMerchantListingName(null);
      return;
    }

    const oid = ord.offer_id as string | null;
    const { data: off } =
      oid && oid.trim() !== ""
        ? await supabase
            .from("merchant_offers")
            .select("payment_instructions")
            .eq("id", oid)
            .maybeSingle()
        : { data: null };

    const { data: mpRow } = await supabase
      .from("merchant_profiles")
      .select("display_name")
      .eq("user_id", ord.merchant_user_id)
      .maybeSingle();

    setMerchantListingName((mpRow as { display_name: string | null } | null)?.display_name ?? null);

    setOrder({
      ...(ord as WorkspaceOrderRow),
      merchant_offers: off ? { payment_instructions: off.payment_instructions } : null,
    });
    setError(null);
  }, [id, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setServerMessages([]);
    setChatSyncError(null);
  }, [id]);

  useEffect(() => {
    if (!id?.trim() || !order) return;
    let cancelled = false;
    setChatSyncError(null);

    void (async () => {
      const { data, error: mErr } = await supabase
        .from("merchant_order_messages")
        .select("id, sender_user_id, body, created_at")
        .eq("order_id", id)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (mErr) {
        setChatSyncError(formatSupabaseError(mErr));
        setServerMessages([]);
        return;
      }
      setServerMessages((data as OrderMessageRow[] | null) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, order?.id, supabase]);

  useEffect(() => {
    if (!id?.trim() || !order) return;

    const channel = supabase
      .channel(`merchant_order_messages:${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "merchant_order_messages",
          filter: `order_id=eq.${id}`,
        },
        (payload) => {
          const row = payload.new as OrderMessageRow;
          if (!row?.id) return;
          setServerMessages((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev;
            const next = [...prev, row];
            next.sort(
              (a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            );
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, order?.id, supabase]);

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  async function run(label: string, fn: () => Promise<{ error: unknown }>) {
    setBusy(label);
    setError(null);
    const { error: e } = await fn();
    setBusy(null);
    if (e) {
      setError(formatSupabaseError(e as Parameters<typeof formatSupabaseError>[0]));
      return;
    }
    await load();
  }

  async function sendTradeMessage(text: string) {
    const trimmed = text.trim().slice(0, 2000);
    if (!trimmed || !userId || !order || chatDisabled) return;
    setChatSending(true);
    setChatSyncError(null);
    const { data: inserted, error: insErr } = await supabase
      .from("merchant_order_messages")
      .insert({ order_id: order.id, body: trimmed })
      .select("id, sender_user_id, body, created_at")
      .single();

    setChatSending(false);

    if (insErr) {
      setChatSyncError(formatSupabaseError(insErr));
      return;
    }
    const row = inserted as OrderMessageRow | null;
    if (!row?.id) return;
    setServerMessages((prev) => {
      if (prev.some((r) => r.id === row.id)) return prev;
      const next = [...prev, row];
      next.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      return next;
    });
  }

  async function confirmInvestorCancel() {
    setCancelBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("investor_cancel_merchant_order", {
      p_order_id: id,
    });
    setCancelBusy(false);
    setCancelOpen(false);
    if (e) {
      setError(formatSupabaseError(e));
      return;
    }
    await load();
  }

  async function confirmMerchantCancel() {
    setCancelBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("merchant_cancel_merchant_order", {
      p_order_id: id,
    });
    setCancelBusy(false);
    setCancelOpen(false);
    if (e) {
      setError(formatSupabaseError(e));
      return;
    }
    await load();
  }

  const chatDisabled =
    !userId || !order || order.status === "completed" || order.status === "cancelled";
  const chatInputDisabled = chatDisabled || chatSending;

  const detailRows = useMemo(() => {
    if (!order) return [];

    // Phase 3 fiat snapshot — locked at order open. NULL on legacy rows.
    const fiatCcy = (order.fiat_currency_code ?? "USD") || "USD";
    const fiatAmt = Number(order.fiat_amount ?? 0);
    const fxRate = Number(order.fx_rate_usd_at_open ?? 1);
    const showFiatRow = fiatCcy !== "USD" && fiatAmt > 0;
    const fiatLine = showFiatRow ? formatFiat(fiatAmt, fiatCcy, { showCode: true }) : null;
    const rateLine = showFiatRow
      ? `1 ${fiatCcy} = ${fxRate.toPrecision(4)} USD (locked at open)`
      : null;

    const orderAsset = assetFromOfferSide(order.side);
    const creditAmt = order.usdt_credit_amount ?? order.btc_credit_amount ?? 0;

    if (order.side === "sell_usdt" || order.side === "sell_btc") {
      return [
        { label: `Amount (${orderAsset})`, value: fmtAssetAmount(orderAsset, order.amount_requested) },
        { label: "Merchant fee", value: `${Number(order.rate_percentage)}%` },
        {
          label: "You receive (on-platform)",
          value: `≈ ${fmtAssetAmount(orderAsset, creditAmt)}`,
          emphasize: true,
        },
        ...(showFiatRow
          ? [
              {
                label: "You pay (fiat)",
                value: `${fiatLine} — settle via ${paymentMethodLabel(order.payment_method)}`,
                emphasize: true,
              },
              { label: "FX snapshot", value: rateLine ?? "" },
            ]
          : [{ label: "Fiat settlement", value: "Off-platform — coordinated in chat / listing" }]),
      ];
    }
    const escrowAmt = order.usdt_escrow_amount ?? order.btc_escrow_amount ?? 0;
    return [
      { label: `${orderAsset} locked`, value: fmtAssetAmount(orderAsset, escrowAmt) },
      { label: "Merchant fee", value: `${Number(order.rate_percentage)}%` },
      ...(showFiatRow
        ? [
            {
              label: "You receive (fiat)",
              value: `${fiatLine} via ${paymentMethodLabel(order.payment_method)}`,
              emphasize: true,
            },
            { label: "FX snapshot", value: rateLine ?? "" },
          ]
        : [
            {
              label: "You receive (fiat)",
              value: "Use your payout details below — the merchant sends there",
              emphasize: true,
            },
          ]),
    ];
  }, [order]);

  if (!id?.trim()) {
    return (
      <div className="rounded-md border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        Invalid order.
      </div>
    );
  }

  if (loading && !order) {
    return (
      <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 rounded-md border border-[#D4AF37]/15 bg-black/40 text-zinc-400">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
        <p className="text-sm">Loading trade…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-md border border-[#D4AF37]/15 bg-black/40 px-4 py-8 text-center">
        <p className="text-zinc-400">Order not found.</p>
        {onBack ? (
          <button type="button" onClick={onBack} className={`mt-4 inline-block ${linkCls}`}>
            {backLabel}
          </button>
        ) : (
          <Link href={backHref} className={`mt-4 inline-block ${linkCls}`}>
            {backLabel}
          </Link>
        )}
      </div>
    );
  }

  const isInvestor = userId === order.investor_user_id;
  const isMerchant = userId === order.merchant_user_id;

  const expires = new Date(order.expires_at).getTime();
  const leftSec =
    order.status === "pending_payment" ? Math.max(0, Math.floor((expires - Date.now()) / 1000)) : 0;
  void tick;

  // Only the party paying fiat may cancel (pending or after they marked paid, before release).
  const payerMayCancel =
    order.status === "pending_payment" || order.status === "paid";

  const showInvestorCancel =
    isInvestor &&
    payerMayCancel &&
    (order.side === "sell_usdt" || order.side === "sell_btc");

  const showMerchantCancel =
    isMerchant &&
    payerMayCancel &&
    (order.side === "buy_usdt" || order.side === "buy_btc");

  const btnPrimary =
    "inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 px-4 text-[14px] font-semibold text-white shadow-sm ring-1 ring-[#D4AF37]/30 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50";

  const btnReleaseSell =
    "inline-flex h-10 w-full items-center justify-center rounded-md bg-red-600 px-4 text-[14px] font-semibold text-white shadow-sm ring-1 ring-red-400/35 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50";

  const btnCancel =
    "inline-flex h-10 w-full items-center justify-center rounded-md border border-red-500/40 bg-black/35 px-4 text-[14px] font-medium text-red-300 transition hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50";

  const counterpartName = isMerchant ? "Investor" : merchantListingName ?? "Merchant";

  const shellHeight = embedded
    ? "min-h-0 max-lg:min-h-[min(560px,82dvh)] lg:h-[min(720px,calc(100vh-13rem))] lg:min-h-[480px]"
    : "min-h-0 max-lg:min-h-[calc(100dvh-5.25rem)] lg:h-[calc(100dvh-2.5rem)] lg:min-h-[640px]";

  const effectiveBackHref = isMerchant ? "/merchant" : backHref;
  const effectiveBackLabel = isMerchant ? "← Merchant dashboard" : backLabel;

  const backControl =
    onBack != null ? (
      <button type="button" onClick={onBack} className={linkCls}>
        {effectiveBackLabel}
      </button>
    ) : (
      <Link href={effectiveBackHref} className={linkCls}>
        {effectiveBackLabel}
      </Link>
    );

  const showTimer = leftSec > 0;
  const payLabel = paymentMethodLabel(order.payment_method);
  // Whoever is sending fiat (investor in sell_usdt, merchant in buy_usdt)
  // needs the fiat amount — not the USDT side. Snapshot was locked at open.
  const orderFiatCcy = (order.fiat_currency_code ?? "USD") || "USD";
  const orderFiatAmt = Number(order.fiat_amount ?? 0);
  const hasFiatSnapshot = orderFiatCcy !== "USD" && orderFiatAmt > 0;
  const fiatTradeAmount = hasFiatSnapshot ? formatFiat(orderFiatAmt, orderFiatCcy) : null;
  const orderAsset = assetFromOfferSide(order.side);
  const cryptoTradeAmount =
    order.side === "sell_usdt" || order.side === "sell_btc"
      ? fmtAssetAmount(orderAsset, order.amount_requested)
      : fmtAssetAmount(orderAsset, order.usdt_escrow_amount ?? order.btc_escrow_amount ?? 0);
  const tradeAmount = fiatTradeAmount ?? cryptoTradeAmount;

  const canMarkPaidInvestor =
    isInvestor &&
    (order.side === "sell_usdt" || order.side === "sell_btc") &&
    order.status === "pending_payment";
  const canMarkPaidMerchant =
    isMerchant &&
    (order.side === "buy_usdt" || order.side === "buy_btc") &&
    order.status === "pending_payment";
  const canReleaseMerchant =
    isMerchant &&
    (order.side === "sell_usdt" || order.side === "sell_btc") &&
    order.status === "paid";
  const canReleaseInvestor =
    isInvestor &&
    (order.side === "buy_usdt" || order.side === "buy_btc") &&
    order.status === "paid";

  return (
    <>
      <div className="relative flex w-full min-w-0 flex-col overflow-hidden rounded-md border border-[#D4AF37]/15 bg-[#070b12]/95 text-white shadow-[0_0_0_1px_rgba(212,175,55,0.05)] backdrop-blur-md">
        <div className={`relative flex w-full min-h-0 flex-col ${shellHeight}`}>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#D4AF37]/12 bg-black/40 px-5 py-3 sm:px-6">
            {backControl}
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-zinc-400">
              <span className="font-mono">#{order.id.slice(0, 8)}</span>
              <span className="text-zinc-600">·</span>
              <span>{orderStatusHeadline(order.status)}</span>
              {showTimer ? (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="font-mono tabular-nums text-[#F5E6B3]">{formatHMS(leftSec)}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
            <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto border-b border-[#D4AF37]/12 bg-black/35 px-4 py-3 max-lg:max-h-[42dvh] sm:gap-4 sm:py-4 lg:w-[280px] lg:max-h-none lg:border-b-0 lg:border-r [scrollbar-width:thin]">
              <div className="hidden rounded-md border border-[#D4AF37]/18 bg-black/40 p-4 lg:block">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[#F5E6B3]">
                  <Lock className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                  {orderStatusHeadline(order.status)}
                </div>
                {showTimer ? (
                  <p className="mt-2 text-[12px] text-zinc-500">
                    Time left:{" "}
                    <span className="font-mono font-semibold text-[#F5E6B3]">{formatHMS(leftSec)}</span>
                  </p>
                ) : null}
              </div>

              {error ? (
                <div className="rounded-md border border-red-500/35 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-200">
                  {error}
                </div>
              ) : null}

              <details
                open
                className="group rounded-md border border-[#D4AF37]/18 bg-black/40 p-4 [&_summary::-webkit-details-marker]:hidden lg:open"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#D4AF37]/85 lg:cursor-default">
                  Offer terms
                  <ChevronDown
                    className="h-4 w-4 text-[#D4AF37]/70 transition-transform group-open:rotate-180 lg:hidden"
                    aria-hidden
                  />
                </summary>
                <p className="mt-2 rounded-md border border-white/[0.08] bg-black/45 px-3 py-2 text-[12.5px] text-zinc-300">
                  Instant release · {payLabel}
                </p>
                {canMarkPaidInvestor || canMarkPaidMerchant ? (
                  <p className="mt-3 text-[12.5px] leading-relaxed text-zinc-400">
                    {canMarkPaidInvestor ? (
                      <>
                        Make a payment of{" "}
                        <span className="font-semibold text-white">{tradeAmount}</span>
                        {hasFiatSnapshot ? (
                          <span className="text-zinc-500">
                            {" "}
                            (~{cryptoTradeAmount})
                          </span>
                        ) : null}{" "}
                        using <span className="font-semibold text-white">{payLabel}</span> and press{" "}
                        <span className="font-semibold text-emerald-300">“Mark as Paid”</span> below.
                      </>
                    ) : (
                      <>
                        Send{" "}
                        <span className="font-semibold text-white">{tradeAmount}</span>
                        {hasFiatSnapshot ? (
                          <span className="text-zinc-500"> (~{cryptoTradeAmount} escrow)</span>
                        ) : null}{" "}
                        to the seller&apos;s payout details, then press{" "}
                        <span className="font-semibold text-emerald-300">“Mark as Paid”</span>.
                      </>
                    )}
                  </p>
                ) : null}
              </details>

              {userId ? (
                <div className="space-y-2">
                  {canMarkPaidInvestor ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void run("paid", async () =>
                          supabase.rpc("investor_mark_merchant_order_paid", {
                            p_order_id: order.id,
                            p_proof: null,
                          }),
                        )
                      }
                      className={btnPrimary}
                    >
                      {busy === "paid" ? "Saving…" : "Mark as Paid"}
                    </button>
                  ) : null}

                  {canMarkPaidMerchant ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void run("mc_mark_paid", async () =>
                          supabase.rpc("merchant_mark_buy_order_paid", {
                            p_order_id: order.id,
                            p_proof: null,
                          }),
                        )
                      }
                      className={btnPrimary}
                    >
                      {busy === "mc_mark_paid" ? "Saving…" : "Mark as Paid"}
                    </button>
                  ) : null}

                  {canReleaseMerchant ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void run("release", async () =>
                          supabase.rpc("merchant_release_buy_order", { p_order_id: order.id }),
                        )
                      }
                      className={btnPrimary}
                    >
                      {busy === "release" ? "Releasing…" : `Release ${orderAsset}`}
                    </button>
                  ) : null}

                  {canReleaseInvestor ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void run("release_sell", async () =>
                          supabase.rpc("investor_release_merchant_buy_order", {
                            p_order_id: order.id,
                          }),
                        )
                      }
                      className={btnReleaseSell}
                    >
                      {busy === "release_sell" ? "Releasing…" : `Release ${orderAsset}`}
                    </button>
                  ) : null}

                  {showInvestorCancel || showMerchantCancel ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => setCancelOpen(true)}
                      className={btnCancel}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="rounded-md border border-[#D4AF37]/15 bg-black/40 px-3 py-2 text-[12.5px] text-zinc-500">
                  Sign in to mark paid or cancel.
                </p>
              )}

              <details className="group rounded-md border border-[#D4AF37]/18 bg-black/40 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-[13px] font-semibold text-[#F5E6B3]">
                  Trade actions
                  <ChevronDown
                    className="h-4 w-4 text-[#D4AF37]/70 transition-transform group-open:rotate-0 -rotate-90"
                    aria-hidden
                  />
                </summary>
                <div className="space-y-2 border-t border-[#D4AF37]/12 px-4 py-3 text-[12.5px] text-zinc-400">
                  <p>Open a dispute or report an issue from chat once milestones complete.</p>
                  {order.proof_of_payment ? (
                    <p className="break-all">
                      Ref:{" "}
                      <span className="font-mono text-zinc-300">{order.proof_of_payment}</span>
                    </p>
                  ) : null}
                </div>
              </details>

              <details className="group rounded-md border border-[#D4AF37]/18 bg-black/40 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-[13px] font-semibold text-[#F5E6B3]">
                  Trade information
                  <ChevronDown
                    className="h-4 w-4 text-[#D4AF37]/70 transition-transform group-open:rotate-0 -rotate-90"
                    aria-hidden
                  />
                </summary>
                <dl className="divide-y divide-[#D4AF37]/10 border-t border-[#D4AF37]/12 text-[12.5px]">
                  {detailRows.map(({ label, value }) => (
                    <div key={label} className="flex items-start justify-between gap-3 px-4 py-2.5">
                      <dt className="text-zinc-500">{label}</dt>
                      <dd className="text-right font-medium text-white">{value}</dd>
                    </div>
                  ))}
                  <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <dt className="text-zinc-500">Payment method</dt>
                    <dd className="text-right font-medium text-white">{payLabel}</dd>
                  </div>
                </dl>
              </details>
            </aside>

            <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#05080F]">
              <div className="flex shrink-0 items-center gap-3 border-b border-[#D4AF37]/12 bg-black/40 px-5 py-3 sm:px-6">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/15 text-[12px] font-semibold text-[#F5E6B3] ring-1 ring-[#D4AF37]/35"
                  aria-hidden
                >
                  {merchantInitials(counterpartName)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-white">{counterpartName}</p>
                  <p className="text-[11px] text-zinc-500">{payLabel}</p>
                </div>
              </div>

              {tradePanelsDerived ? (
                <div className="shrink-0 border-b border-[#D4AF37]/10 bg-[#05080F]">
                  <TradeOrderBrief
                    panels={tradePanelsDerived}
                    orderSide={order.side}
                    investorPayoutInstructions={order.investor_payout_instructions}
                    isMerchant={isMerchant}
                  />
                </div>
              ) : (
                <div className="border-b border-[#D4AF37]/10 px-5 py-3 text-[12.5px] text-zinc-500 sm:px-6">
                  Loading trade context…
                </div>
              )}

              {chatSyncError ? (
                <div className="shrink-0 border-b border-red-500/30 bg-red-500/10 px-5 py-2 text-[12.5px] text-red-200 sm:px-6">
                  {chatSyncError}
                </div>
              ) : null}

              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <TradeChat
                  counterpartLabel={counterpartName}
                  messages={combinedChatMessages}
                  onSend={(t) => void sendTradeMessage(t)}
                  disabled={chatInputDisabled}
                  placeholder={chatSending ? "Sending…" : "Write a message…"}
                />
              </div>
            </section>
          </div>
        </div>
      </div>

      <CancelModal
        open={cancelOpen}
        onClose={() => {
          if (!cancelBusy) setCancelOpen(false);
        }}
        busy={cancelBusy}
        onConfirm={() => {
          if (isInvestor) void confirmInvestorCancel();
          else if (isMerchant) void confirmMerchantCancel();
        }}
      />
    </>
  );
}
