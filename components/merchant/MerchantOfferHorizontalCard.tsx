"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { MerchantOfferAvatar } from "@/components/p2p/MerchantOfferAvatar";
import { sideLabel } from "@/components/merchant/merchantOfferSide";
import { paymentMethodLabel } from "@/components/p2p/utils";
import { getFiatCurrency } from "@/lib/currencies";
import { formatMoneyAmount } from "@/lib/formatMoney";

export type MerchantOfferHorizontalRow = {
  id: string;
  side: string;
  status: string;
  min_limit: number;
  max_limit: number;
  rate_percentage: number;
  payment_methods: string[];
  advert_message: string | null;
  fiat_currency_code: string | null;
};

type MerchantOfferHorizontalCardProps = {
  offer: MerchantOfferHorizontalRow;
  merchantAvatarUrl?: string | null;
  merchantDisplayName?: string | null;
  onToggleActive: () => void;
  onDelete: () => void;
};

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
      <span className="block shrink-0 text-[9px] font-extrabold uppercase tracking-[0.14em] text-zinc-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
        {label}
      </span>
      <div className="mt-0.5 min-w-0">{children}</div>
    </div>
  );
}

/**
 * Merchant listing row — same interaction model as investor OfferCard:
 * rigid grid zones, emerald wash, advert column before actions, bold CTAs.
 */
export function MerchantOfferHorizontalCard({
  offer,
  merchantAvatarUrl,
  merchantDisplayName,
  onToggleActive,
  onDelete,
}: MerchantOfferHorizontalCardProps) {
  const methodsDisplay = offer.payment_methods.map((c) => paymentMethodLabel(c)).join(" · ") || "—";
  const isActive = offer.status === "active";
  const advert = offer.advert_message?.trim();

  const gridColsLg =
    "lg:grid-cols-[minmax(0,9.75rem)_4rem_7.25rem_9.625rem_minmax(0,1fr)_4.75rem_auto]";

  const pauseBtn =
    "rounded-xl border-2 border-emerald-400/50 bg-gradient-to-b from-emerald-800/50 to-black/60 px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_14px_-4px_rgba(16,185,129,0.45)] ring-1 ring-emerald-500/35 transition hover:-translate-y-px hover:border-emerald-300/60 hover:shadow-[0_8px_22px_-6px_rgba(16,185,129,0.5)] active:translate-y-0";

  const delBtn =
    "rounded-xl border-2 border-red-500/55 bg-gradient-to-b from-red-950/40 to-black/50 px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-red-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_14px_-4px_rgba(239,68,68,0.35)] ring-1 ring-red-400/30 transition hover:-translate-y-px hover:border-red-400/70 hover:shadow-[0_8px_22px_-6px_rgba(239,68,68,0.45)] active:translate-y-0";

  const editBtn =
    "rounded-xl border-2 border-[#D4AF37]/45 bg-gradient-to-b from-[#D4AF37]/15 to-black/50 px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#F5E6B3] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_14px_-4px_rgba(212,175,55,0.35)] ring-1 ring-[#D4AF37]/30 transition hover:-translate-y-px hover:border-[#D4AF37]/65 active:translate-y-0";

  return (
    <article
      aria-label={`Offer ${sideLabel(offer.side)} ${offer.status}`}
      className={`relative isolate grid w-full min-w-0 gap-y-3 overflow-hidden rounded-xl border border-white/[0.1] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_56px_-16px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/[0.14] backdrop-blur-sm transition duration-200 lg:gap-x-0 lg:gap-y-0 lg:px-4 lg:py-3 xl:ring-emerald-400/[0.18] hover:-translate-y-0.5 hover:border-emerald-400/35 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_72px_-12px_rgba(16,185,129,0.42),0_12px_32px_-20px_rgba(0,0,0,0.5)] hover:ring-emerald-300/25 ${gridColsLg} max-lg:grid-cols-1`}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-emerald-400/[0.08] via-black/52 to-teal-950/50"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -inset-px rounded-[inherit] bg-[radial-gradient(ellipse_88%_78%_at_78%_40%,rgba(52,211,153,0.11),transparent_55%)]"
        aria-hidden
      />

      <div className="relative z-[1] flex min-w-0 flex-col justify-center gap-1.5 max-lg:border-b max-lg:border-white/10 max-lg:pb-3 lg:border-r lg:border-white/10 lg:pr-4">
        <div className="flex items-start gap-2.5">
          <MerchantOfferAvatar
            avatarUrl={merchantAvatarUrl}
            displayName={merchantDisplayName}
            size="sm"
          />
          <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ring-1 ${
              isActive
                ? "bg-emerald-500/25 text-emerald-50 shadow-[0_0_12px_-2px_rgba(52,211,153,0.55)] ring-emerald-400/45"
                : "bg-zinc-700/30 text-zinc-400 ring-zinc-600/55"
            }`}
          >
            {offer.status}
          </span>
          {offer.fiat_currency_code ? (
            <span
              className="inline-flex rounded-full bg-[#D4AF37]/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#F5E6B3] ring-1 ring-[#D4AF37]/40"
              title={`Settles in ${getFiatCurrency(offer.fiat_currency_code).name}`}
            >
              {getFiatCurrency(offer.fiat_currency_code).flag} {offer.fiat_currency_code}
            </span>
          ) : null}
        </div>
        <p className="bg-gradient-to-r from-[#FFF8E7] via-[#F5E6B3] to-[#E8CF7A] bg-clip-text text-sm font-extrabold uppercase tracking-wide text-transparent drop-shadow-[0_0_14px_rgba(245,230,179,0.25)]">
          {sideLabel(offer.side)}
        </p>
          </div>
        </div>
      </div>

      <Zone label="Fee" aria-label={`Listing fee ${offer.rate_percentage} percent`}>
        <p className="text-2xl font-extrabold tabular-nums leading-none tracking-tight text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.35)]">
          {offer.rate_percentage}%
        </p>
      </Zone>

      <Zone
        label="Limits"
        aria-label={`Limits ${formatMoneyAmount(offer.min_limit)} to ${formatMoneyAmount(offer.max_limit)} ${offer.fiat_currency_code ?? "USD"}`}
      >
        <p className="truncate text-[15px] font-extrabold tabular-nums tracking-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
          {formatMoneyAmount(offer.min_limit)}
          <span className="text-zinc-500"> — </span>
          {formatMoneyAmount(offer.max_limit)}
          <span className="text-[11px] font-semibold uppercase text-emerald-200/55">
            {" "}
            {offer.fiat_currency_code ?? "USD"}
          </span>
        </p>
      </Zone>

      <Zone label="Pay methods" aria-label={`Payment rails ${methodsDisplay}`}>
        <p
          className="truncate text-[13px] font-semibold uppercase tracking-[0.08em] text-zinc-100 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
          title={methodsDisplay}
        >
          {methodsDisplay}
        </p>
      </Zone>

      <Zone
        emphasized
        label={<span className="text-[#FFE9A8] drop-shadow-[0_0_10px_rgba(245,215,140,0.35)]">Merchant advert</span>}
        aria-label={advert ? `Advert ${advert}` : "No advert text"}
      >
        {advert ? (
          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-[#EDE8DD] drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]" title={advert}>
            {advert}
          </p>
        ) : (
          <p className="truncate text-[13px] font-semibold italic text-[#87807a]">No note</p>
        )}
      </Zone>

      <Zone label="Listing ID" aria-label={`Offer id ${offer.id}`}>
        <p className="truncate font-mono text-[11px] font-semibold text-zinc-400" title={offer.id}>
          {offer.id.slice(0, 8)}…
        </p>
      </Zone>

      <div className="relative z-[1] flex min-h-[3rem] flex-wrap items-center justify-end gap-2 px-3 max-lg:border-t max-lg:border-white/10 max-lg:pt-4 lg:border-l lg:border-t-0 lg:border-white/10 lg:pl-4 lg:pt-0">
        <Link href={`/merchant/offers/${offer.id}/edit`} className={editBtn}>
          Edit
        </Link>
        <button type="button" onClick={onToggleActive} className={pauseBtn}>
          {isActive ? "Pause" : "On"}
        </button>
        <button type="button" onClick={onDelete} className={delBtn}>
          Del
        </button>
      </div>
    </article>
  );
}
