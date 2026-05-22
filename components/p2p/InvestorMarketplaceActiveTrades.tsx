"use client";

import { useCallback, useEffect, useState } from "react";

import { merchantInitials, orderStatusHeadline, paymentMethodLabel } from "@/components/p2p/utils";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";
import { formatFiat } from "@/lib/currencies";
import { formatMoneyAmount } from "@/lib/formatMoney";

/** Subset aligned with toolbar “Trades” menu (browse uses offers list, not this component). */
export type InvestorTradesBucket = "active" | "completed" | "cancelled";

type InvestorTradeRow = {
  id: string;
  side: string;
  status: string;
  amount_requested: number;
  payment_method: string;
  fee_amount: number;
  created_at: string;
  merchant_user_id: string;
  merchant_display_name: string | null;
  fiat_currency_code: string | null;
  fiat_amount: number | null;
};

function investorFlowLabel(side: string): string {
  if (side === "sell_usdt") return "Buying USDT";
  if (side === "buy_usdt") return "Selling USDT";
  return side;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "pending_payment":
      return "bg-amber-500/15 text-amber-200 ring-amber-400/35";
    case "paid":
      return "bg-sky-500/15 text-sky-200 ring-sky-400/35";
    case "completed":
      return "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30";
    case "cancelled":
      return "bg-red-500/12 text-red-200 ring-red-400/30";
    default:
      return "bg-white/10 text-zinc-300 ring-white/15";
  }
}

/** Investor tickets for marketplace “Trades” menu (active · completed · cancelled). */
export function InvestorMarketplaceActiveTrades({
  bucket,
  refreshKey,
  onOpenOrder,
}: {
  bucket: InvestorTradesBucket;
  refreshKey?: number | string;
  onOpenOrder: (orderId: string) => void;
}) {
  const supabase = useSupabase();
  const [rows, setRows] = useState<InvestorTradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setRows([]);
      setError("Sign in to see your trades.");
      return;
    }

    let q = supabase
      .from("merchant_orders")
      .select(
        "id, side, status, amount_requested, payment_method, fee_amount, created_at, merchant_user_id, fiat_currency_code, fiat_amount",
      )
      .eq("investor_user_id", user.id);

    if (bucket === "active") {
      q = q.in("status", ["pending_payment", "paid"]);
    } else if (bucket === "completed") {
      q = q.eq("status", "completed");
    } else {
      q = q.eq("status", "cancelled");
    }

    const { data: ord, error: qErr } = await q.order("created_at", { ascending: false });

    if (qErr) {
      setLoading(false);
      setRows([]);
      setError(formatSupabaseError(qErr));
      return;
    }

    const ordersRaw = (ord ?? []) as Omit<InvestorTradeRow, "merchant_display_name">[];
    const mids = [...new Set(ordersRaw.map((r) => r.merchant_user_id).filter(Boolean))] as string[];

    let nameMap = new Map<string, string | null>();
    if (mids.length > 0) {
      const { data: profs, error: pErr } = await supabase
        .from("merchant_profiles")
        .select("user_id, display_name")
        .in("user_id", mids);

      if (pErr) {
        setLoading(false);
        setRows([]);
        setError(formatSupabaseError(pErr));
        return;
      }
      nameMap = new Map(
        (profs ?? []).map((p: { user_id: string; display_name: string | null }) => [
          p.user_id,
          p.display_name ?? null,
        ]),
      );
    }

    const merged: InvestorTradeRow[] = ordersRaw.map((r) => ({
      ...r,
      amount_requested: Number(r.amount_requested),
      fee_amount: Number(r.fee_amount ?? 0),
      fiat_amount: r.fiat_amount == null ? null : Number(r.fiat_amount),
      merchant_display_name: nameMap.get(r.merchant_user_id) ?? null,
    }));

    setRows(merged);
    setLoading(false);
  }, [bucket, supabase]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[5.25rem] w-full animate-pulse rounded-xl bg-emerald-500/[0.04] ring-1 ring-emerald-500/15" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
    );
  }

  const emptyCopy =
    bucket === "active"
      ? "No active trades yet. Browse offers above — pick BUY or SELL on a row when you are ready."
      : bucket === "completed"
        ? "No completed P2P tickets yet."
        : "No cancelled trades in this bucket.";

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D4AF37]/25 bg-black/25 px-6 py-16 text-center backdrop-blur-sm">
        <p className="text-zinc-400">{emptyCopy}</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onOpenOrder(r.id)}
            className="flex w-full gap-3 rounded-xl border border-emerald-500/[0.12] bg-black/35 px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition hover:border-[#D4AF37]/40 hover:bg-black/55 sm:px-4"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1a2a1a] to-[#0f1f0f] text-[10px] font-bold uppercase text-[#F5E6B3] ring-1 ring-[#D4AF37]/35"
              aria-hidden
            >
              {merchantInitials(r.merchant_display_name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-bold text-[#F5E6B3]">
                  {r.merchant_display_name || "Merchant"}
                </span>
                <span
                  className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${statusBadgeClass(r.status)}`}
                >
                  {orderStatusHeadline(r.status)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                {investorFlowLabel(r.side)}
                {" · "}
                <span className="font-semibold text-zinc-200 tabular-nums">
                  {formatMoneyAmount(r.amount_requested)} USDT
                </span>
                {r.fiat_currency_code && r.fiat_currency_code !== "USD" && r.fiat_amount && r.fiat_amount > 0 ? (
                  <span className="text-zinc-500">
                    {" · "}
                    <span className="tabular-nums">{formatFiat(Number(r.fiat_amount), r.fiat_currency_code)}</span>
                  </span>
                ) : null}
                {" · "}
                {paymentMethodLabel(r.payment_method)}
                {Number.isFinite(r.fee_amount) && r.fee_amount > 0 ? (
                  <>
                    {" · "}Fee {formatMoneyAmount(r.fee_amount)}
                  </>
                ) : null}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">
                Started{" "}
                {new Date(r.created_at).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
