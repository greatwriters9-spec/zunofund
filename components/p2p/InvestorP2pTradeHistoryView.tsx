"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { merchantInitials, orderStatusHeadline, paymentMethodLabel } from "@/components/p2p/utils";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";
import { formatFiat } from "@/lib/currencies";
import { formatMoneyAmount } from "@/lib/formatMoney";

type InvestorTradeRow = {
  id: string;
  side: string;
  status: string;
  amount_requested: number;
  payment_method: string;
  fee_amount: number;
  created_at: string;
  expires_at: string;
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
      return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/35";
    case "cancelled":
      return "bg-red-500/12 text-red-200 ring-red-400/30";
    default:
      return "bg-white/10 text-zinc-300 ring-white/15";
  }
}

function TradeRows({ rows }: { rows: InvestorTradeRow[] }) {
  if (rows.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/p2p/order/${r.id}`}
            className="flex gap-3 rounded-xl border border-white/10 bg-black/35 px-3 py-3 transition hover:border-[#D4AF37]/35 hover:bg-black/55 sm:px-4"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1a2a1a] to-[#0f1f0f] text-[10px] font-bold uppercase text-[#F5E6B3] ring-1 ring-[#D4AF37]/25"
              aria-hidden
            >
              {merchantInitials(r.merchant_display_name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold text-[#F5E6B3]">
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
                <span className="font-semibold text-zinc-300 tabular-nums">
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
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SectionCard({
  title,
  subtitle,
  count,
  rows,
  emptyHint,
}: {
  title: string;
  subtitle: string;
  count: number;
  rows: InvestorTradeRow[];
  emptyHint: string;
}) {
  return (
    <section className="rounded-2xl border border-[#D4AF37]/18 bg-black/35 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-3">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-[0.08em] text-[#F5E6B3]">{title}</h2>
          <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
        </div>
        <span className="tabular-nums text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {count} {count === 1 ? "trade" : "trades"}
        </span>
      </div>
      <div className="mt-4">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">{emptyHint}</p>
        ) : (
          <TradeRows rows={rows} />
        )}
      </div>
    </section>
  );
}

/** Full-page investor P2P ledger: Active, Completed (settled), and Cancelled trades. */
export function InvestorP2pTradeHistoryView() {
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
      setError("Sign in to view your P2P trade history.");
      return;
    }

    const { data: ord, error: qErr } = await supabase
      .from("merchant_orders")
      .select(
        "id, side, status, amount_requested, payment_method, fee_amount, created_at, expires_at, merchant_user_id, fiat_currency_code, fiat_amount",
      )
      .eq("investor_user_id", user.id)
      .order("created_at", { ascending: false });

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
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const { active, completed, cancelled } = useMemo(() => {
    const activeRows = rows.filter(
      (r) => r.status === "pending_payment" || r.status === "paid" || r.status === "disputed",
    );
    const completedRows = rows.filter((r) => r.status === "completed");
    const cancelledRows = rows.filter((r) => r.status === "cancelled");
    return { active: activeRows, completed: completedRows, cancelled: cancelledRows };
  }, [rows]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-white/[0.06]" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[200px] animate-pulse rounded-2xl bg-white/[0.05]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <SectionCard
        title="Active trades"
        subtitle="Awaiting fiat or USDT settlement — opens the live ticket."
        count={active.length}
        rows={active}
        emptyHint="When you open a new P2P order, it will appear here until the trade completes or expires."
      />

      <SectionCard
        title="Completed trades"
        subtitle="Successfully finished — USDT moved per the trade outcome."
        count={completed.length}
        rows={completed}
        emptyHint="No settled trades yet. Completed orders show here once both sides finalize."
      />

      <SectionCard
        title="Cancelled trades"
        subtitle="Timed out or cancelled before completion."
        count={cancelled.length}
        rows={cancelled}
        emptyHint="Cancelled and expired trades land here."
      />

      {!error && rows.length === 0 ? (
        <p className="text-center text-sm text-zinc-500">
          You don&apos;t have any P2P orders yet — start from the{" "}
          <Link href="/p2p" className="font-medium text-[#D4AF37] hover:text-[#F5E6B3] hover:underline">
            marketplace
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
