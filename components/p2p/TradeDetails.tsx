"use client";

import type { ReactNode } from "react";

import { paymentMethodLabel } from "./utils";

export type TradeDetailsProps = {
  paymentMethodCode: string;
  rows: { label: string; value: ReactNode; emphasize?: boolean }[];
  /** Inside trade shell sidebar — no outer margins */
  embedded?: boolean;
  /** Tighter typography and paddings for the live-trade shell */
  compact?: boolean;
  /** Omit the footer chip when the parent surfaces method elsewhere */
  showMethodFooter?: boolean;
};

export function TradeDetails({
  paymentMethodCode,
  rows,
  embedded,
  compact = false,
  showMethodFooter = true,
}: TradeDetailsProps) {
  const shell =
    embedded && compact
      ? "rounded-xl border border-white/[0.06] bg-black/[0.14] p-3 backdrop-blur-sm"
      : embedded
        ? "rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-sm"
        : "mx-4 rounded-2xl border border-white/10 bg-black/35 p-4 shadow-lg shadow-black/25 backdrop-blur-sm sm:mx-5";

  const titleCls =
    compact === true
      ? "text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]/80"
      : "text-[11px] font-semibold uppercase tracking-wider text-[#D4AF37]/90";

  const dlSpace = compact ? "mt-2 space-y-2" : "mt-4 space-y-3";
  const rowBorder = compact ? "border-white/[0.06] pb-2" : "border-white/10 pb-3";
  const dtCls = compact ? "text-xs text-zinc-500" : "text-sm text-zinc-500";
  const ddEmph = compact ? "text-sm font-semibold text-emerald-400" : "text-base font-semibold text-emerald-400";
  const ddNorm = compact ? "text-xs font-medium text-zinc-100" : "text-sm font-medium text-white";

  return (
    <section className={shell}>
      <h2 className={titleCls}>Trade snapshot</h2>
      <dl className={dlSpace}>
        {rows.map(({ label, value, emphasize }) => (
          <div
            key={label}
            className={`flex items-start justify-between gap-3 border-b ${rowBorder} last:border-0 last:pb-0`}
          >
            <dt className={dtCls}>{label}</dt>
            <dd className={`text-right tabular-nums ${emphasize ? ddEmph : ddNorm}`}>{value}</dd>
          </div>
        ))}
      </dl>
      {showMethodFooter ? (
        <div
          className={
            compact
              ? "mt-3 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-1.5 text-[11px] text-zinc-500"
              : "mt-4 rounded-xl border border-[#D4AF37]/15 bg-black/40 px-3 py-2 text-xs text-zinc-500"
          }
        >
          Method:{" "}
          <span className="font-medium text-[#F5E6B3]/90">{paymentMethodLabel(paymentMethodCode)}</span>
        </div>
      ) : null}
    </section>
  );
}
