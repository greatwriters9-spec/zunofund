"use client";

import Link from "next/link";
import type { MerchantOrderCard } from "./merchantOrderTypes";

function sideLabel(side: string) {
  if (side === "sell_usdt") return "Merchant sells USDT (you deliver)";
  if (side === "buy_usdt") return "Merchant buys USDT (counterparty sells)";
  return side;
}

function amountLine(o: MerchantOrderCard) {
  if (o.side === "sell_usdt" && o.usdt_credit_amount != null) {
    return `$${Number(o.usdt_credit_amount).toFixed(2)} credited (net of fee)`;
  }
  if (o.side === "buy_usdt" && o.usdt_escrow_amount != null) {
    return `$${Number(o.usdt_escrow_amount).toFixed(2)} escrow`;
  }
  return `$${Number(o.amount_requested).toFixed(2)}`;
}

function investorLabel(inv: MerchantOrderCard["investor"]) {
  if (!inv) return "Investor";
  const name =
    typeof inv.full_name === "string" && inv.full_name.trim() !== ""
      ? inv.full_name.trim()
      : null;
  if (name) return name;
  return inv.email || "Investor";
}

export function MerchantTradesList(props: {
  orders: MerchantOrderCard[];
  emptyMessage: string;
  /** `console` matches merchant dashboard / P2P gold–emerald chrome. */
  variant?: "default" | "console";
}) {
  const { orders, emptyMessage, variant = "default" } = props;

  const isConsole = variant === "console";

  const wrapTable = isConsole
    ? "overflow-hidden rounded-xl border border-[#D4AF37]/22 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    : "overflow-hidden rounded-xl border border-zinc-800";

  const thead = isConsole
    ? "border-b border-white/10 bg-black/40 text-[11px] uppercase tracking-[0.12em] text-[#D4AF37]/85"
    : "border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase tracking-wide text-zinc-500";

  const tbody = isConsole ? "divide-y divide-white/[0.06] bg-black/25" : "divide-y divide-zinc-800 bg-zinc-950/60";

  const rowHover = isConsole ? "hover:bg-emerald-500/[0.06]" : "hover:bg-zinc-900/50";

  const linkBtn = isConsole
    ? "rounded-xl border-2 border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-[#F5E6B3] shadow-[0_0_16px_-4px_rgba(212,175,55,0.35)] transition hover:-translate-y-px hover:bg-[#D4AF37]/20"
    : "rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-1.5 text-xs font-semibold text-yellow-200 hover:bg-yellow-500/20";

  const emptyBox = isConsole
    ? "rounded-xl border border-dashed border-emerald-500/25 bg-black/25 px-4 py-8 text-center text-sm text-zinc-500"
    : "rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-500";

  if (orders.length === 0) {
    return <p className={emptyBox}>{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {/* desktop table */}
      <div className={`hidden md:block ${wrapTable}`}>
        <table className="w-full text-left text-sm">
          <thead className={thead}>
            <tr>
              <th className="px-4 py-3 font-medium">Opened</th>
              <th className="px-4 py-3 font-medium">Investor</th>
              <th className="px-4 py-3 font-medium">Direction</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className={tbody}>
            {orders.map((o) => (
              <tr key={o.id} className={rowHover}>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-300">
                  <time dateTime={o.created_at}>
                    {new Date(o.created_at).toLocaleString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-100">{investorLabel(o.investor)}</p>
                  {o.investor?.email ? (
                    <p className="font-mono text-xs text-zinc-500">{o.investor.email}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-zinc-400">{sideLabel(o.side)}</td>
                <td className="px-4 py-3 text-zinc-200">{amountLine(o)}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      "inline-flex rounded-lg px-2 py-0.5 text-xs font-medium " +
                      (o.status === "completed"
                        ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
                        : o.status === "cancelled"
                          ? "bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/25"
                          : o.status === "paid"
                            ? "bg-yellow-500/15 text-yellow-200 ring-1 ring-yellow-500/35"
                            : "bg-blue-500/15 text-blue-200 ring-1 ring-blue-500/35")
                    }
                  >
                    {o.status.replace("_", " ")}
                  </span>
                  {o.status === "pending_payment" && o.expires_at ? (
                    <p className="mt-1 text-xs text-zinc-600">
                      Expires{" "}
                      {new Date(o.expires_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Link href={`/p2p/order/${o.id}`} className={linkBtn}>
                    Open trade
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* mobile cards */}
      <div className="space-y-3 md:hidden">
        {orders.map((o) => (
          <article
            key={o.id}
            className={
              isConsole
                ? "relative isolate overflow-hidden rounded-xl border border-emerald-500/20 bg-black/35 p-4 shadow-[0_0_40px_-14px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/10"
                : "rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-sm shadow-black/20"
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{investorLabel(o.investor)}</p>
                {o.investor?.email ? (
                  <p className="mt-0.5 font-mono text-xs text-zinc-500">{o.investor.email}</p>
                ) : null}
                <p className="mt-2 text-xs text-zinc-500">
                  Opened{" "}
                  <time dateTime={o.created_at}>
                    {new Date(o.created_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </p>
              </div>
              <Link href={`/p2p/order/${o.id}`} className={linkBtn}>
                View
              </Link>
            </div>
            <p className="mt-3 text-xs text-zinc-500">{sideLabel(o.side)}</p>
            <p className="mt-1 text-lg font-semibold text-white">{amountLine(o)}</p>
            <p className="mt-2 text-xs font-medium capitalize text-yellow-400/90">
              {String(o.status).replace(/_/g, " ")}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
