"use client";

import type { ReactNode } from "react";

import { assetFromOfferSide, fmtAssetAmount, type P2pAssetCode } from "@/lib/p2pAssets";
import { formatFiat, getFiatCurrency } from "@/lib/currencies";
import { fromUsd } from "@/lib/exchangeRates";
import { useFxRates } from "@/lib/useFx";

import { paymentMethodLabelCaps, merchantInitials } from "./utils";

function cryptoToFiat(
  cryptoAmount: number,
  asset: P2pAssetCode,
  fiatCode: string,
  rates: Record<string, number>,
): number {
  const usd =
    asset === "BTC"
      ? cryptoAmount * (rates.BTC ?? 70000)
      : cryptoAmount;
  return fromUsd(usd, fiatCode, rates);
}

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
  fiat_currency_code: string;
};

type OfferCardProps = {
  row: OfferCardRow;
  flow: "buy" | "sell";
  asset: P2pAssetCode;
  /** When invalid, trade stays disabled — display still uses merchant min_limit for previews. */
  amountCrypto: number;
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

export function OfferCard({ row, flow, asset, amountCrypto, busy, onTrade }: OfferCardProps) {
  const name = row.merchant_display_name || "Merchant";
  const { rates } = useFxRates();
  const offerAsset = assetFromOfferSide(row.side);

  const browsingMode = !(Number.isFinite(amountCrypto) && amountCrypto > 0);
  const qRaw = browsingMode ? row.min_limit : amountCrypto;
  const clampedQty = Math.min(Math.max(qRaw, row.min_limit), row.max_limit);

  const feeCrypto = clampedQty * (Number(row.rate_percentage) / 100);
  const netBuyer = clampedQty - feeCrypto;

  const fiatCode = row.fiat_currency_code || "USD";
  const showFiat = fiatCode !== "USD";
  const fiatMin = cryptoToFiat(Number(row.min_limit), offerAsset, fiatCode, rates);
  const fiatMax = cryptoToFiat(Number(row.max_limit), offerAsset, fiatCode, rates);
  const fiatGross = cryptoToFiat(clampedQty, offerAsset, fiatCode, rates);
  const fiatNet = cryptoToFiat(netBuyer, offerAsset, fiatCode, rates);

  const methodsCompact =
    row.payment_methods.slice(0, 2).map((c) => paymentMethodLabelCaps(c)).join(" · ") ||
    paymentMethodLabelCaps(row.payment_methods[0] ?? "");
  const methodsMore = row.payment_methods.length > 2 ? ` · +${row.payment_methods.length - 2}` : "";

  const primaryLabel = flow === "buy" ? "Buy" : "Sell";

  const btnDisabled = busy;

  const btnBuyClass =
    "mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-[12px] font-extrabold uppercase tracking-wide text-white ring-1 ring-emerald-400/35 transition hover:bg-emerald-500 disabled:pointer-events-none disabled:opacity-40 sm:mt-0 md:max-w-[9.5rem]";

  const btnSellClass =
    "mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl bg-red-600 px-4 py-2.5 text-center text-[12px] font-extrabold uppercase tracking-wide text-white ring-1 ring-red-400/35 transition hover:bg-red-500 disabled:pointer-events-none disabled:opacity-40 sm:mt-0 md:max-w-[9.5rem]";

  const feePct = Number(row.rate_percentage).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

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
          <p className="mt-1 text-[11px] font-medium tabular-nums text-zinc-400">
            {fmtAssetAmount(offerAsset, row.min_limit)}–{fmtAssetAmount(offerAsset, row.max_limit)}{" "}
            <span className="uppercase tracking-wide text-zinc-600">{offerAsset} · limits</span>
          </p>
          {showFiat ? (
            <p className="text-[10px] tabular-nums text-zinc-500">
              ≈ {formatFiat(fiatMin, fiatCode)} – {formatFiat(fiatMax, fiatCode)}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-red-200 ring-1 ring-red-400/35">
              +{feePct}% fee
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
              value={showFiat ? formatFiat(fiatGross, fiatCode) : `${clampedQty.toFixed(2)} USDT`}
              sub={
                showFiat
                  ? `≈ ${clampedQty.toFixed(2)} USDT · settle off-platform`
                  : "Settle fiat with merchant off-platform."
              }
            />
            <PayReceiveCol
              top="Receive"
              value={`≈ ${netBuyer.toFixed(2)} USDT`}
              sub={
                showFiat
                  ? `≈ ${formatFiat(fiatNet, fiatCode)} · ${feePct}% fee`
                  : `Uses ${feePct}% rate on sampled size`
              }
            />
          </>
        ) : (
          <>
            <PayReceiveCol
              top="Escrow lock"
              value={fmtAssetAmount(offerAsset, clampedQty)}
              sub="Released after your fiat settles."
            />
            <PayReceiveCol
              top={`Receive (${fiatCode})`}
              value={
                showFiat ? (
                  formatFiat(fiatNet, fiatCode)
                ) : (
                  <span className="text-[13px] font-semibold">≈ {netBuyer.toFixed(2)} USD</span>
                )
              }
              sub={`${methodsCompact}${methodsMore} · net of ${feePct}% fee`}
            />
          </>
        )}
      </div>

      <div className="flex flex-col items-stretch md:items-stretch md:justify-center">
        <button type="button" disabled={btnDisabled} onClick={onTrade} className={flow === "buy" ? btnBuyClass : btnSellClass}>
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
