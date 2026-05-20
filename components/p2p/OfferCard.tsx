"use client";

import type { ReactNode } from "react";

import { paymentMethodLabelCaps, merchantInitials } from "./utils";

export type OfferCardRow = {
  offer_id: string;
  merchant_user_id: string;
  merchant_display_name: string | null;
  side: string;
  payment_methods: string[];
  min_limit: number;
  max_limit: number;
  rate_percentage: number;
  payment_instructions: string | null;
  advert_message: string | null;
};

type OfferCardProps = {
  row: OfferCardRow;
  flow: "buy" | "sell";
  amountUsdt: number;
  busy?: boolean;
  onTrade: () => void;
  /** BTC/USD spot — reference only for “~X BTC” estimate on this USDT size. */
  btcUsd: number | null;
  ethUsd: number | null;
};

/** Fixed grid cell with optional caption; keep aria-label for assistive tech. */
function Zone({
  label,
  emphasized,
  children,
  "aria-label": ariaLabel,
}: {
  label: ReactNode;
  emphasized?: boolean;
  children: ReactNode;
  "aria-label": string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`relative z-[1] flex min-h-[3rem] min-w-0 flex-col justify-center px-3 max-lg:border-t max-lg:pt-3 lg:border-l lg:border-t-0 lg:pt-0 ${
        emphasized
          ? "max-lg:border-[#D4AF37]/22 lg:border-l-[#D4AF37]/40"
          : "max-lg:border-white/10 lg:border-white/10"
      }`}
    >
      <span className="block shrink-0 text-[9px] font-extrabold uppercase tracking-[0.14em] text-zinc-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">{label}</span>
      <div className="mt-0.5 min-w-0">{children}</div>
    </div>
  );
}

export function OfferCard({
  row,
  flow,
  amountUsdt,
  busy,
  onTrade,
  btcUsd,
  ethUsd,
}: OfferCardProps) {
  const name = row.merchant_display_name || "Merchant";
  const feeAmount =
    Number.isFinite(amountUsdt) && amountUsdt > 0 ? (amountUsdt * Number(row.rate_percentage)) / 100 : 0;
  const credit =
    flow === "buy" && Number.isFinite(amountUsdt) && amountUsdt > 0 ? amountUsdt - feeAmount : null;

  const primaryLabel = flow === "buy" ? "BUY" : "SELL";

  const btcEquiv =
    btcUsd && Number.isFinite(btcUsd) && btcUsd > 0 && Number.isFinite(amountUsdt) && amountUsdt > 0
      ? amountUsdt / btcUsd
      : null;
  const ethEquiv =
    ethUsd && Number.isFinite(ethUsd) && ethUsd > 0 && Number.isFinite(amountUsdt) && amountUsdt > 0
      ? amountUsdt / ethUsd
      : null;

  const methodsLabel =
    row.payment_methods.map((c) => paymentMethodLabelCaps(c)).join(" · ") || "—";
  const advert = row.advert_message?.trim();

  const btnClass =
    flow === "buy"
      ? "rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-700 px-7 py-[0.6875rem] text-center text-[13px] font-extrabold uppercase tracking-[0.16em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(0,0,0,0.15),0_4px_12px_-2px_rgba(16,185,129,0.35),0_0_36px_-6px_rgba(34,211,153,0.45)] ring-2 ring-emerald-300/50 transition hover:-translate-y-px hover:from-emerald-300 hover:to-emerald-600 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_12px_32px_-6px_rgba(16,185,129,0.55)] active:translate-y-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:from-emerald-400 disabled:hover:to-emerald-700 lg:min-w-[6.75rem]"
      : "rounded-xl bg-gradient-to-b from-red-500 to-red-800 px-7 py-[0.6875rem] text-center text-[13px] font-extrabold uppercase tracking-[0.16em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.22),0_4px_12px_-2px_rgba(239,68,68,0.45),0_0_38px_-6px_rgba(248,113,113,0.35)] ring-2 ring-red-400/55 transition hover:-translate-y-px hover:from-red-400 hover:to-red-700 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.26),0_14px_36px_-6px_rgba(239,68,68,0.55)] active:translate-y-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:from-red-500 disabled:hover:to-red-800 lg:min-w-[6.75rem]";

  const btnDisabled = busy || !Number.isFinite(amountUsdt) || amountUsdt <= 0;

  const gridColsLg =
    "lg:grid-cols-[minmax(0,11rem)_3.875rem_7rem_9.625rem_10.75rem_6.5rem_minmax(0,1fr)_auto]";

  const creditTitle =
    credit != null ? `Estimated credited amount ${credit.toFixed(2)} USDT` : "Estimated credit not applicable";

  return (
    <article
      aria-label={`Offer from ${name}`}
      className={`relative isolate grid w-full min-w-0 gap-y-3 overflow-hidden rounded-xl border border-white/[0.1] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_56px_-16px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/[0.14] backdrop-blur-sm transition duration-200 lg:gap-x-0 lg:gap-y-0 lg:px-4 lg:py-3 xl:ring-emerald-400/[0.18] hover:-translate-y-0.5 hover:border-emerald-400/35 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_72px_-12px_rgba(16,185,129,0.42),0_12px_32px_-20px_rgba(0,0,0,0.5)] hover:ring-emerald-300/25 ${gridColsLg} max-lg:grid-cols-1`}
    >
      {/* Wash + glow — behind content */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-emerald-400/[0.08] via-black/52 to-teal-950/50"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -inset-px rounded-[inherit] bg-[radial-gradient(ellipse_90%_75%_at_72%_42%,rgba(52,211,153,0.11),transparent_55%)]"
        aria-hidden
      />

      {/* Merchant — column 1 */}
      <div className="relative z-[1] flex min-w-0 items-center gap-3 max-lg:border-b max-lg:border-white/10 max-lg:pb-3 lg:border-r lg:border-white/10 lg:pr-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-900/85 to-black/85 text-[12px] font-extrabold uppercase text-[#FFF4D6] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_0_26px_-4px_rgba(212,175,55,0.5)] ring-2 ring-[#D4AF37]/65"
          aria-hidden
        >
          {merchantInitials(row.merchant_display_name)}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className="truncate bg-gradient-to-r from-[#FFF8E7] via-[#F5E6B3] to-[#E8CF7A] bg-clip-text text-lg font-extrabold tracking-tight text-transparent drop-shadow-[0_0_20px_rgba(245,230,179,0.35)] sm:text-xl"
            title={name}
          >
            {name}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/25 px-2 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_16px_-2px_rgba(52,211,153,0.55)] ring-1 ring-emerald-400/50">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-35" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.9)]" />
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-50">Online</span>
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-200/85">Verified</span>
          </div>
        </div>
      </div>

      <Zone label="Fee" aria-label={`Merchant fee ${row.rate_percentage} percent`}>
        <>
          <p className="text-2xl font-extrabold tabular-nums leading-none tracking-tight text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.35)]">{Number(row.rate_percentage)}%</p>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-200/65">Your side</p>
        </>
      </Zone>

      <Zone label="Limits" aria-label={`Order limits ${row.min_limit} to ${row.max_limit} USDT`}>
        <p
          className="truncate text-[15px] font-extrabold tabular-nums leading-tight tracking-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
          title={`${row.min_limit}–${row.max_limit} USDT`}
        >
          {row.min_limit}
          <span className="text-zinc-500"> — </span>
          {row.max_limit}
          <span className="text-[11px] font-semibold uppercase text-emerald-200/55"> USDT</span>
        </p>
      </Zone>

      <Zone label="Pay methods" aria-label={`Payment methods ${methodsLabel}`}>
        <p className="truncate text-[13px] font-semibold uppercase tracking-[0.1em] text-zinc-100 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" title={methodsLabel}>
          {methodsLabel}
        </p>
      </Zone>

      <Zone label="Spot reference" aria-label="Bitcoin and ethereum spot estimates for display size">
        <div className="flex h-[2.875rem] flex-col justify-center gap-1 rounded-md bg-black/25 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-emerald-500/15">
          <p className="truncate text-[11px] font-semibold tabular-nums leading-snug text-white" title="BTC spot and size estimate">
            <span className="font-bold text-emerald-400/95">BTC </span>
            {btcUsd != null ? `$${btcUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
            {btcEquiv != null ? <span className="font-medium text-emerald-200/65"> · ~{btcEquiv.toFixed(4)} BTC</span> : null}
          </p>
          <p className="truncate text-[11px] font-semibold tabular-nums leading-snug text-zinc-100" title="ETH spot and size estimate">
            <span className="font-bold text-teal-400/90">ETH </span>
            {ethUsd != null ? `$${ethUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
            {ethEquiv != null ? <span className="font-medium text-teal-200/65"> · ~{ethEquiv.toFixed(3)} ETH</span> : null}
          </p>
        </div>
      </Zone>

      <Zone label="Est. credit" aria-label={creditTitle}>
        {credit != null ? (
          <>
            <p className="truncate text-[15px] font-extrabold tabular-nums tracking-tight text-emerald-200 drop-shadow-[0_0_14px_rgba(110,231,183,0.35)]" title={`${credit.toFixed(2)} USDT`}>
              ${credit.toFixed(2)}
              <span className="text-[11px] font-semibold uppercase text-emerald-300/65"> USDT</span>
            </p>
            <p className="mt-1 truncate text-[9px] font-semibold uppercase tracking-wide text-emerald-300/55">Buy flow · before on-chain</p>
          </>
        ) : (
          <p className="text-[15px] font-bold text-zinc-500 tabular-nums">—</p>
        )}
      </Zone>

      <Zone
        emphasized
        label={<span className="text-[#FFE9A8] drop-shadow-[0_0_10px_rgba(245,215,140,0.35)]">Merchant advert</span>}
        aria-label={advert ? `Merchant advert ${advert}` : "No merchant advert"}
      >
        {advert ? (
          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-[#EDE8DD] drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]" title={advert}>
            {advert}
          </p>
        ) : (
          <p className="truncate text-[13px] font-semibold italic text-[#87807a]">No note</p>
        )}
      </Zone>

      <div className="relative z-[1] flex min-h-[3rem] min-w-0 items-center justify-end px-3 max-lg:border-t max-lg:border-white/10 max-lg:pt-4 lg:border-l lg:border-t-0 lg:border-white/10 lg:pt-0">
        <button type="button" disabled={btnDisabled} onClick={onTrade} className={btnClass}>
          {busy ? "…" : primaryLabel}
        </button>
      </div>
    </article>
  );
}
