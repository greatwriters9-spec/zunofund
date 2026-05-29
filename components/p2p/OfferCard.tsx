"use client";

import type { ReactNode } from "react";

import { assetFromOfferSide, fmtAssetAmount, type P2pAssetCode } from "@/lib/p2pAssets";
import { formatFiat, getFiatCurrency } from "@/lib/currencies";
import {
  clampFiatToLimits,
  cryptoToFiat,
  fiatToCrypto,
  inputToOfferFiat,
} from "@/lib/p2pValue";
import { useFxRates } from "@/lib/useFx";
import { formatInvestorMerchantPresence } from "@/lib/merchantPresence";
import { paymentMethodLabelCaps, merchantInitials } from "./utils";

export type OfferCardRow = {
  offer_id: string;
  merchant_user_id: string;
  merchant_display_name: string | null;
  merchant_is_online?: boolean | null;
  merchant_last_seen_at?: string | null;
  merchant_presence_mode?: string | null;
  side: string;
  payment_methods: string[];
  min_limit: number;
  max_limit: number;
  rate_percentage: number;
  payment_instructions: string | null;
  advert_message: string | null;
  fiat_currency_code: string;
};

type OfferCardProps = {
  row: OfferCardRow;
  flow: "buy" | "sell";
  asset: P2pAssetCode;
  toolbarAmount: number;
  inputCurrency: string;
  busy?: boolean;
  onTrade: () => void;
};

function PayReceiveCol({
  top,
  value,
  sub,
}: {
  top: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="min-w-[7rem] shrink-0" role="group">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{top}</p>
      <p className="mt-1 tabular-nums text-[15px] font-bold leading-tight tracking-tight text-white">{value}</p>
      {sub ? <div className="mt-1 text-[10px] leading-snug text-zinc-500">{sub}</div> : null}
    </div>
  );
}

export function OfferCard({
  row,
  flow,
  asset,
  toolbarAmount,
  inputCurrency,
  busy,
  onTrade,
}: OfferCardProps) {
  const name = row.merchant_display_name || "Merchant";
  const presence = formatInvestorMerchantPresence(
    row.merchant_is_online,
    row.merchant_last_seen_at,
    row.merchant_presence_mode,
  );
  const { rates } = useFxRates();
  const offerAsset = assetFromOfferSide(row.side);
  const fiatCode = (row.fiat_currency_code || "USD").toUpperCase();
  const minFiat = Number(row.min_limit);
  const maxFiat = Number(row.max_limit);

  const amountFiat =
    toolbarAmount > 0 ? inputToOfferFiat(toolbarAmount, inputCurrency, fiatCode, rates) : 0;
  const browsingMode = !(amountFiat > 0);
  const clampedFiat = browsingMode ? minFiat : clampFiatToLimits(amountFiat, minFiat, maxFiat);
  const clampedCrypto = fiatToCrypto(clampedFiat, fiatCode, offerAsset, rates);

  const ratePct = Number(row.rate_percentage) || 0;
  const feeCrypto = clampedCrypto * (ratePct / 100);
  const netCrypto = clampedCrypto - feeCrypto;

  const rateFactor = 1 + ratePct / 100;
  const sellLockCrypto = clampedCrypto / Math.max(0.0001, rateFactor);

  const methodsCompact =
    row.payment_methods.slice(0, 2).map((c) => paymentMethodLabelCaps(c)).join(" · ") ||
    paymentMethodLabelCaps(row.payment_methods[0] ?? "");
  const methodsMore = row.payment_methods.length > 2 ? ` · +${row.payment_methods.length - 2}` : "";

  const primaryLabel = flow === "buy" ? "Buy" : "Sell";

  const btnBuyClass =
    "mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-[12px] font-extrabold uppercase tracking-wide text-white ring-1 ring-emerald-400/35 transition hover:bg-emerald-500 disabled:pointer-events-none disabled:opacity-40 sm:mt-0 md:max-w-[9.5rem]";

  const btnSellClass =
    "mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl bg-red-600 px-4 py-2.5 text-center text-[12px] font-extrabold uppercase tracking-wide text-white ring-1 ring-red-400/35 transition hover:bg-red-500 disabled:pointer-events-none disabled:opacity-40 sm:mt-0 md:max-w-[9.5rem]";

  const feePct = Math.abs(ratePct).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const rateBadge =
    flow === "sell"
      ? ratePct >= 0
        ? `+${feePct}% above spot`
        : `${Number(row.rate_percentage).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}% below spot`
      : `+${feePct}% fee`;

  return (
    <article
      aria-label={`Offer from ${name}`}
      className="grid gap-4 border-b border-white/[0.07] px-4 py-4 text-[13px] text-zinc-200 last:border-b-0 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.65fr)_auto]"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/55 text-[11px] font-extrabold uppercase text-[#F5E6B3] ring-1 ring-[#D4AF37]/55"
          aria-hidden
        >
          {merchantInitials(row.merchant_display_name)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-bold tracking-tight text-[#F5E6B3]" title={name}>
            {name}
          </h3>
          <div className="mt-1">
            <p
              className={`flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide ${
                presence.online ? "text-emerald-300" : "text-yellow-300"
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  presence.online
                    ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.75)]"
                    : "bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.65)]"
                }`}
                aria-hidden
              />
              {presence.primary}
            </p>
            {presence.secondary ? (
              <p className="mt-0.5 pl-3.5 text-[10px] font-medium tabular-nums text-zinc-500">
                {presence.secondary}
              </p>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] font-medium tabular-nums text-zinc-400">
            {formatFiat(minFiat, fiatCode)}–{formatFiat(maxFiat, fiatCode)}{" "}
            <span className="uppercase tracking-wide text-zinc-600">{fiatCode} · limits</span>
          </p>
          <p className="text-[10px] tabular-nums text-zinc-500">
            ≈ {fmtAssetAmount(offerAsset, fiatToCrypto(minFiat, fiatCode, offerAsset, rates))} –{" "}
            {fmtAssetAmount(offerAsset, fiatToCrypto(maxFiat, fiatCode, offerAsset, rates))}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold tabular-nums ring-1 ${
                flow === "sell" && ratePct >= 0
                  ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/35"
                  : flow === "sell" && ratePct < 0
                    ? "bg-orange-500/15 text-orange-200 ring-orange-400/35"
                    : "bg-red-500/15 text-red-200 ring-red-400/35"
              }`}
            >
              {rateBadge}
            </span>
            <span
              className="rounded-md bg-[#D4AF37]/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#F5E6B3] ring-1 ring-[#D4AF37]/35"
              title={`Settles in ${getFiatCurrency(row.fiat_currency_code).name}`}
            >
              {getFiatCurrency(row.fiat_currency_code).flag} {row.fiat_currency_code}
            </span>
            <span className="truncate text-[10px] font-semibold uppercase tracking-wide leading-snug text-zinc-500">
              {(methodsCompact || "—") + methodsMore}
            </span>
          </div>
          {row.advert_message?.trim() ? (
            <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-zinc-600" title={row.advert_message}>
              “{row.advert_message.trim()}”
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-end gap-6 sm:flex-nowrap sm:justify-between lg:justify-start lg:gap-10">
        {flow === "buy" ? (
          <>
            <PayReceiveCol
              top={`Pay (${browsingMode ? "from " : ""}${fiatCode})`}
              value={formatFiat(clampedFiat, fiatCode)}
              sub={`≈ ${fmtAssetAmount(offerAsset, clampedCrypto)} · settle off-platform`}
            />
            <PayReceiveCol
              top="Receive"
              value={`≈ ${fmtAssetAmount(offerAsset, netCrypto)}`}
              sub={`${feePct}% fee on sampled size`}
            />
          </>
        ) : (
          <>
            <PayReceiveCol
              top="Escrow lock"
              value={fmtAssetAmount(offerAsset, sellLockCrypto)}
              sub={`${ratePct >= 0 ? `${feePct}% above spot — lock less` : `${feePct}% below spot — lock more`} · after fiat settles`}
            />
            <PayReceiveCol
              top={`Receive (${fiatCode})`}
              value={formatFiat(clampedFiat, fiatCode)}
              sub={`${methodsCompact}${methodsMore} · merchant sends fiat`}
            />
          </>
        )}
      </div>

      <div className="flex flex-col items-stretch md:items-stretch md:justify-center">
        <button type="button" disabled={busy} onClick={onTrade} className={flow === "buy" ? btnBuyClass : btnSellClass}>
          {busy ? "…" : primaryLabel}{" "}
          <span className="tabular-nums text-[11px] font-bold opacity-95">{offerAsset}</span>
        </button>
        {browsingMode ? (
          <p className="mt-2 text-center text-[9px] leading-snug text-zinc-600 md:max-w-[9.5rem] md:text-left">
            We’ll ask for an amount before opening the trade.
          </p>
        ) : null}
      </div>
    </article>
  );
}
