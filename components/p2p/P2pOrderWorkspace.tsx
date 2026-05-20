"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CancelModal } from "@/components/p2p/CancelModal";
import { TradeActions } from "@/components/p2p/TradeActions";
import type { ChatMessage } from "@/components/p2p/TradeChat";
import { TradeChat } from "@/components/p2p/TradeChat";
import { TradeDetails } from "@/components/p2p/TradeDetails";
import { TradeHeader } from "@/components/p2p/TradeHeader";
import { zunoGlassCard, zunoGoldGradientOverlay } from "@/components/p2p/zunoTheme";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";
import { getP2pPaymentMethodLabel } from "@/lib/p2pPaymentMethods";

type OrderMessageRow = {
  id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
};

export type WorkspaceOrderRow = {
  id: string;
  investor_user_id: string;
  merchant_user_id: string;
  offer_id: string | null;
  side: "sell_usdt" | "buy_usdt";
  amount_requested: number;
  rate_percentage: number;
  fee_amount: number;
  usdt_credit_amount: number | null;
  usdt_escrow_amount: number | null;
  payment_method: string;
  proof_of_payment: string | null;
  investor_payout_instructions?: string | null;
  status: string;
  expires_at: string;
  deposit_id: string | null;
  merchant_offers: {
    payment_instructions: string | null;
  } | null;
  created_at?: string;
};

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

/** Trim very long pasted instructions inside auto-generated bubbles. */
function clampTradeText(raw: string, max = 1100): string {
  const t = raw.trim();
  if (!t.length) return t;
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

const linkCls = "text-sm font-medium text-[#D4AF37] transition hover:text-[#F5E6B3]";

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
    const payLabel = getP2pPaymentMethodLabel(order.payment_method);
    const rate = Number(order.rate_percentage).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
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

    if (order.side === "sell_usdt") {
      const amt = Number(order.amount_requested).toFixed(2);
      const cred = Number(order.usdt_credit_amount ?? 0).toFixed(2);
      const summary = isMerchView
        ? `This investor is buying $${amt} USDT from your listing.\n\nOnce their fiat settles off-platform and you release escrow, roughly $${cred} USDT will land in their wallet here.\n\nMerchant fee baked into your rate: ${rate}%. Coordinating channel: ${payLabel}.`
        : `You are buying $${amt} USDT in this escrow.\n\nAfter you’ve sent fiat as agreed and the merchant verifies it, approximately $${cred} USDT will be credited to your on-platform balance.\n\nMerchant fee: ${rate}%. Coordinating channel: ${payLabel}.`;

      out.push(sys("sys-trade-summary-sell", summary, "default"));

      const bespoke = clampTradeText(order.merchant_offers?.payment_instructions ?? "");
      const core = bespoke.length
        ? bespoke
        : `No custom bank/till/account lines were stored on this offer. Nail down the precise pay-in destination together in chat; still route through ${payLabel} unless you both clearly agree otherwise here.`;

      const instructionBlock = isMerchView
        ? `Fiat payout reference for you (merchant):\nHow the investor should compensate you mirrors what appears below unless you amend it openly in-thread.\n\n${core}`
        : `Merchant payment instructions:\nTransmit fiat only according to these details.\nDo not blindly trust SMS, WhatsApp forwards, or e-mail that contradict this escrow.\n\n${core}`;

      out.push(sys("sys-trade-instructions-sell", instructionBlock, "default"));
    } else {
      const esc = Number(order.usdt_escrow_amount ?? 0).toFixed(2);
      const payout = clampTradeText(order.investor_payout_instructions ?? "");

      const summary = isMerchView
        ? `$${esc} USDT is escrowed until you complete your fiat payout.\nCheck the payout coordinates in this ticket, send funds through ${payLabel}, then hit Mark as Paid once the payment is dispatched.\nYour quoted merchant fee tier: ${rate}%.`
        : `You are selling $${esc} USDT that is escrowed here.\n\nYou will collect fiat externally using the payout mandate in this conversation; release USDT to the merchant only after funds have cleared.\n\nFee quoted on their listing: ${rate}%. Coordinating channel: ${payLabel}.`;

      out.push(sys("sys-trade-summary-buy", summary, "default"));

      const payoutLines =
        payout.length > 0
          ? payout
          : "(Payout specifics were blank when the trade opened — clarify bank / mobile-money handles here before fiat moves.)";

      const payoutBlock = isMerchView
        ? `Seller payout instructions:\nTransmit fiat ONLY to these coordinates unless the investor posts an updated version here:\n\n${payoutLines}`
        : `Your fiat payout mandate (merchant must honour this verbatim):\n\n${payoutLines}`;

      out.push(sys("sys-trade-instructions-buy", payoutBlock, "default"));
    }

    const st = order.status;
    if (st === "cancelled") {
      out.push(sys("sys-cancelled", "This trade has been cancelled.", "default"));
      return out;
    }

    if (st === "paid" || st === "completed") {
      let paidBody: string;
      if (order.side === "sell_usdt") {
        paidBody = isMerchView
          ? "The buyer marked this trade as paid. Confirm their fiat, then release USDT when satisfied."
          : "Payment marked successfully. The merchant is confirming your payment.";
      } else {
        paidBody = isMerchView
          ? "You marked fiat as sent. Waiting for the seller to verify receipt and release USDT."
          : "The merchant marked the fiat payment as sent. Confirm you received funds, then release USDT when satisfied.";
      }
      out.push(sys("sys-milestone-paid", paidBody, "success"));
    }

    if (st === "completed") {
      out.push(
        sys(
          "sys-milestone-complete",
          "Trade completed successfully.",
          "success",
        ),
      );
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
      return;
    }

    if (!ord) {
      setOrder(null);
      setError(null);
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
    if (order.side === "sell_usdt") {
      return [
        { label: "Amount (USDT)", value: `$${Number(order.amount_requested).toFixed(2)}` },
        { label: "Merchant fee", value: `${Number(order.rate_percentage)}%` },
        {
          label: "You receive (on-platform)",
          value: `~$${Number(order.usdt_credit_amount ?? 0).toFixed(2)} USDT`,
          emphasize: true,
        },
        { label: "Fiat settlement", value: "Off-platform — coordinated in chat / listing" },
      ];
    }
    return [
      { label: "USDT locked", value: `$${Number(order.usdt_escrow_amount ?? 0).toFixed(2)}` },
      { label: "Merchant fee", value: `${Number(order.rate_percentage)}%` },
      {
        label: "You receive (fiat)",
        value: "Use your payout details below — the merchant sends there",
        emphasize: true,
      },
    ];
  }, [order]);

  if (!id?.trim()) {
    return embedded ? (
      <div className="rounded-2xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        Invalid order.
      </div>
    ) : (
      <p className="text-red-400">Invalid order.</p>
    );
  }

  if (loading && !order) {
    return embedded ? (
      <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/20 text-zinc-400">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
        <p className="text-sm text-zinc-500">Loading trade…</p>
      </div>
    ) : (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-zinc-400">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
        <p className="mt-4 text-sm text-zinc-500">Loading trade…</p>
      </div>
    );
  }

  if (!order) {
    return embedded ? (
      <div className="rounded-2xl border border-white/12 bg-black/25 px-4 py-6 text-center backdrop-blur-sm">
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
    ) : (
      <div>
        <p className="text-zinc-400">Order not found.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-[#D4AF37] hover:text-[#F5E6B3] hover:underline">
          Dashboard
        </Link>
      </div>
    );
  }

  const isInvestor = userId === order.investor_user_id;
  const isMerchant = userId === order.merchant_user_id;

  const expires = new Date(order.expires_at).getTime();
  const leftSec =
    order.status === "pending_payment" ? Math.max(0, Math.floor((expires - Date.now()) / 1000)) : 0;
  void tick;

  const showInvestorCancel =
    isInvestor &&
    order.status === "pending_payment" &&
    (order.side === "sell_usdt" || order.side === "buy_usdt");

  const showMerchantCancel = isMerchant && order.status === "pending_payment";

  const btnPrimary =
    "w-full rounded-xl bg-emerald-600/90 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-black/30 ring-1 ring-[#D4AF37]/28 transition hover:bg-emerald-500 disabled:opacity-50";

  const btnPrimaryInline =
    "min-h-[42px] flex-1 rounded-xl bg-emerald-600/90 px-3 py-2.5 text-center text-sm font-semibold text-white shadow-sm shadow-black/30 ring-1 ring-[#D4AF37]/28 transition hover:bg-emerald-500 disabled:opacity-50 sm:min-w-0";

  const btnSellPrimary =
    "w-full rounded-xl bg-red-600/90 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-900/35 ring-1 ring-red-400/30 transition hover:bg-red-500 disabled:opacity-50";

  const btnCancelOutline =
    "min-h-[42px] w-full rounded-xl border border-red-500/45 bg-transparent px-3 py-2.5 text-sm font-semibold text-red-400/95 transition hover:bg-red-500/10 disabled:opacity-50 sm:w-auto sm:flex-1";

  const shellHeight =
    embedded
      ? "lg:h-[min(680px,calc(100vh-13rem))] lg:min-h-[420px]"
      : "lg:h-[min(860px,calc(100dvh-7rem))] lg:min-h-[520px]";

  const backControl =
    onBack != null ? (
      <button type="button" onClick={onBack} className={linkCls}>
        {backLabel}
      </button>
    ) : (
      <Link href={backHref} className={linkCls}>
        {backLabel}
      </Link>
    );

  return (
    <>
      <div className={`relative flex w-full min-w-0 flex-col overflow-hidden ${zunoGlassCard}`}>
        <div className={zunoGoldGradientOverlay} />

        <div className={`relative flex w-full min-h-0 flex-col ${shellHeight}`}>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-black/[0.12] px-4 py-2 backdrop-blur-sm sm:px-5">
              {backControl}
              <span className="font-mono text-[11px] text-zinc-500">
                Order #{order.id.slice(0, 8)}…
              </span>
            </div>

            <TradeHeader status={order.status} countdownSeconds={leftSec} />

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
              <aside className="w-full shrink-0 border-b border-white/[0.06] lg:flex lg:w-[min(360px,34%)] lg:flex-col lg:border-b-0 lg:border-r lg:border-white/[0.06]">
                <div className="max-h-[min(38vh,320px)] space-y-3 overflow-y-auto px-4 py-4 lg:max-h-none lg:flex-1 lg:overflow-y-auto">
                  {error ? (
                    <div className="rounded-2xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {error}
                    </div>
                  ) : null}

                  <TradeDetails
                    embedded
                    compact
                    showMethodFooter={false}
                    paymentMethodCode={order.payment_method}
                    rows={detailRows}
                  />

                  {order.side === "buy_usdt" ? (
                    <section className="rounded-xl border border-white/[0.07] bg-emerald-500/[0.06] px-3 py-3 backdrop-blur-sm">
                      <h2 className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/85">
                        {isMerchant ? "Pay investor (fiat)" : "Your payout lane"}
                      </h2>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-zinc-200/95">
                        {(order.investor_payout_instructions ?? "").trim() || "—"}
                      </p>
                      {!isMerchant ? (
                        <p className="mt-1.5 text-[10px] leading-snug text-zinc-500">
                          Fiat lands here — release crypto only once funds cleared.
                        </p>
                      ) : (
                        <p className="mt-1.5 text-[10px] leading-snug text-zinc-500">
                          Match verbatim, press Mark when dispatched.
                        </p>
                      )}
                    </section>
                  ) : null}

                  {order.proof_of_payment ? (
                    <div className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2 text-[11px] text-zinc-500">
                      <span className="text-zinc-600">Recorded reference:</span>{" "}
                      <span className="break-all font-mono text-zinc-300">{order.proof_of_payment}</span>
                    </div>
                  ) : null}

                  {order.status === "completed" && order.deposit_id ? (
                    <p className="text-center text-xs text-zinc-500 lg:text-left">
                      Completed. Linked deposit: <span className="font-mono text-zinc-400">{order.deposit_id}</span>
                    </p>
                  ) : null}
                </div>
              </aside>

              <div className="flex min-h-[min(44vh,480px)] min-w-0 flex-1 flex-col bg-transparent lg:min-h-0">
                {chatSyncError ? (
                  <div className="shrink-0 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-200 sm:px-5">
                    {chatSyncError}
                  </div>
                ) : null}
                <TradeChat
                  embedded
                  messages={combinedChatMessages}
                  onSend={(t) => void sendTradeMessage(t)}
                  disabled={chatInputDisabled}
                  placeholder={chatSending ? "Sending…" : "Type a message…"}
                />
              </div>
            </div>

            {!userId ? (
              <div className="shrink-0 border-t border-white/[0.06] bg-black/[0.06] px-4 py-3 text-center text-xs text-zinc-500 backdrop-blur-sm">
                Sign in to take actions on this trade.
              </div>
            ) : null}

            {userId ? (
              <TradeActions variant="embedded">
                {isInvestor && order.side === "sell_usdt" && order.status === "pending_payment" ? (
                  <div className="flex w-full gap-3">
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
                      className={btnPrimaryInline}
                    >
                      {busy === "paid" ? "Saving…" : "Mark as Paid"}
                    </button>
                    {showInvestorCancel ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => setCancelOpen(true)}
                        className={`${btnCancelOutline} shrink-0 sm:flex-1`}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {isMerchant && order.side === "sell_usdt" && order.status === "paid" ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void run("release", async () =>
                        supabase.rpc("merchant_release_buy_order", {
                          p_order_id: order.id,
                        }),
                      )
                    }
                    className={btnPrimary}
                  >
                    {busy === "release" ? "Releasing…" : "Release USDT (credit investor)"}
                  </button>
                ) : null}

                {isMerchant && order.side === "buy_usdt" && order.status === "pending_payment" ? (
                  <div className="flex w-full gap-3">
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
                      className={btnPrimaryInline}
                    >
                      {busy === "mc_mark_paid" ? "Saving…" : "Mark as Paid"}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => setCancelOpen(true)}
                      className={`${btnCancelOutline} shrink-0 sm:flex-1`}
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}

                {isInvestor && order.side === "buy_usdt" && order.status === "paid" ? (
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
                    className={btnSellPrimary}
                  >
                    {busy === "release_sell" ? "Releasing…" : "Release USDT to merchant"}
                  </button>
                ) : null}

                {isInvestor && order.side === "buy_usdt" && order.status === "pending_payment" && showInvestorCancel ? (
                  <div className="flex justify-stretch">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => setCancelOpen(true)}
                      className={`${btnCancelOutline} w-full`}
                    >
                      Cancel trade
                    </button>
                  </div>
                ) : null}

                {showMerchantCancel && !(isMerchant && order.side === "buy_usdt") ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => setCancelOpen(true)}
                    className={`${btnCancelOutline} w-full`}
                  >
                    Cancel trade
                  </button>
                ) : null}
              </TradeActions>
            ) : null}
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
