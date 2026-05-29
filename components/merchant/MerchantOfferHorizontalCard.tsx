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

function StatBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <div className="mt-1 min-w-0 text-[13px] font-semibold text-white">{children}</div>
    </div>
  );
}

/**
 * Merchant listing card — vertical stack like investor marketplace rows (one offer per block).
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
  const fiat = offer.fiat_currency_code ?? "USD";

  const actionBtn =
    "inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-4 text-[11px] font-extrabold uppercase tracking-[0.12em] transition active:translate-y-0 sm:min-w-[6.5rem] sm:flex-none";

  return (
    <article
      aria-label={`Offer ${sideLabel(offer.side)} ${offer.status}`}
      className="border-b border-white/[0.08] bg-[#070b12]/40 px-4 py-5 text-[13px] text-zinc-200 last:border-b-0"
    >
      <div className="flex items-start gap-3">
        <MerchantOfferAvatar
          avatarUrl={merchantAvatarUrl}
          displayName={merchantDisplayName ?? sideLabel(offer.side)}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ring-1 ${
                isActive
                  ? "bg-emerald-500/25 text-emerald-50 ring-emerald-400/45"
                  : "bg-zinc-700/30 text-zinc-400 ring-zinc-600/55"
              }`}
            >
              {offer.status}
            </span>
            {offer.fiat_currency_code ? (
              <span
                className="inline-flex rounded-full bg-[#D4AF37]/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#F5E6B3] ring-1 ring-[#D4AF37]/40"
              >
                {getFiatCurrency(offer.fiat_currency_code).flag} {offer.fiat_currency_code}
              </span>
            ) : null}
          </div>
          <h3 className="mt-1 text-[15px] font-extrabold uppercase tracking-wide text-[#F5E6B3]">
            {sideLabel(offer.side)}
          </h3>
          <p className="mt-0.5 font-mono text-[10px] text-zinc-500" title={offer.id}>
            ID {offer.id.slice(0, 8)}…
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatBlock label="Fee">
          <span className="text-xl font-extrabold tabular-nums text-emerald-300">{offer.rate_percentage}%</span>
        </StatBlock>
        <StatBlock label={`Limits (${fiat})`}>
          <span className="tabular-nums">
            {formatMoneyAmount(offer.min_limit)}
            <span className="text-zinc-500"> – </span>
            {formatMoneyAmount(offer.max_limit)}
          </span>
        </StatBlock>
        <StatBlock label="Payment methods">
          <span className="line-clamp-3 text-[12px] font-medium uppercase tracking-wide text-zinc-300" title={methodsDisplay}>
            {methodsDisplay}
          </span>
        </StatBlock>
        <StatBlock label="Advert">
          {advert ? (
            <span className="line-clamp-3 text-[12px] leading-snug text-zinc-300" title={advert}>
              {advert}
            </span>
          ) : (
            <span className="text-[12px] italic text-zinc-600">No note</span>
          )}
        </StatBlock>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link
          href={`/merchant/offers/${offer.id}/edit`}
          className={`${actionBtn} border-2 border-[#D4AF37]/45 bg-[#D4AF37]/12 text-[#F5E6B3] ring-1 ring-[#D4AF37]/25 hover:bg-[#D4AF37]/20`}
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={onToggleActive}
          className={`${actionBtn} border-2 border-emerald-400/50 bg-emerald-900/40 text-emerald-50 ring-1 ring-emerald-500/30 hover:bg-emerald-800/50`}
        >
          {isActive ? "Pause" : "Activate"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className={`${actionBtn} border-2 border-red-500/50 bg-red-950/35 text-red-200 ring-1 ring-red-400/25 hover:bg-red-900/40`}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
