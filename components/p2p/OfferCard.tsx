"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";

import { assetFromOfferSide, fmtAssetAmount, type P2pAssetCode } from "@/lib/p2pAssets";
import { formatFiat } from "@/lib/currencies";
import {
  clampFiatToLimits,
  fiatToCrypto,
  formatOfferUnitPriceAmount,
  inputToOfferFiat,
  offerFiatPerOneCrypto,
} from "@/lib/p2pValue";
import { useFxRates } from "@/lib/useFx";
import { formatInvestorMerchantPresence } from "@/lib/merchantPresence";
import { MerchantOfferAvatar } from "@/components/p2p/MerchantOfferAvatar";
import { paymentMethodLabelCaps } from "./utils";

export type OfferCardRow = {
  offer_id: string;
  merchant_user_id: string;
  merchant_display_name: string | null;
  merchant_is_online?: boolean | null;
  merchant_last_seen_at?: string | null;
  merchant_presence_mode?: string | null;
  merchant_avatar_url?: string | null;
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

function RateVsMpBadge({ ratePct }: { ratePct: number }) {
  const absPct = Math.abs(ratePct).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const aboveMp = ratePct >= 0;
  const signed = aboveMp ? `+${absPct}%` : `-${absPct}%`;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tabular-nums ring-1 max-md:px-1 max-md:py-0 max-md:text-[8px] ${
        aboveMp
          ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/35"
          : "bg-orange-500/15 text-orange-200 ring-orange-400/35"
      }`}
      title={aboveMp ? "Above market price" : "Below market price"}
    >
      {aboveMp ? (
        <ArrowUp className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
      ) : (
        <ArrowDown className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
      )}
      <span>{signed}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wide opacity-90 max-md:hidden">
        {aboveMp ? "above MP" : "below MP"}
      </span>
    </span>
  );
}

function OfferUnitPrice({
  fiatPerCrypto,
  fiatCode,
  asset,
}: {
  fiatPerCrypto: number;
  fiatCode: string;
  asset: P2pAssetCode;
}) {
  const main = formatOfferUnitPriceAmount(fiatPerCrypto, fiatCode);
  const fiatLabel = fiatCode.toLowerCase();

  return (
    <span
      className="inline-flex w-fit shrink-0 items-baseline gap-0.5 rounded-md border border-white/[0.06] bg-[#0a0e16]/80 px-2 py-1 tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-white/[0.04] max-md:px-1.5 max-md:py-0.5"
      title={`${main} ${fiatCode} per 1 ${asset}`}
    >
      <span className="text-[17px] font-bold leading-none tracking-tight text-white max-md:text-[12px]">
        {main}
      </span>
      <span className="pb-px text-[10px] font-semibold uppercase tracking-wide text-zinc-500 max-md:text-[8px]">
        /{fiatLabel}
      </span>
    </span>
  );
}

function formatPaymentMethodsCompact(methods: string[]): { display: string; title: string } {
  const labels = methods.map((c) => paymentMethodLabelCaps(c)).filter(Boolean);
  if (labels.length === 0) {
    return { display: "—", title: "" };
  }
  const title = labels.join(" · ");
  if (labels.length <= 2) {
    return { display: labels.join(" · "), title };
  }
  const rest = labels.length - 2;
  return {
    display: `${labels.slice(0, 2).join(" · ")} · +${rest} other${rest === 1 ? "" : "s"}`,
    title,
  };
}

const DETAIL_LABEL =
  "text-[10px] font-semibold uppercase tracking-[0.12em] leading-[15px] text-zinc-500 max-md:text-[8px] max-md:tracking-[0.08em] max-md:leading-none";

/** Mobile: merchant full width, then method | pay | receive | action (note hidden). */
const OFFER_MOBILE_GRID_CLASS =
  "grid grid-cols-[minmax(0,1fr)_minmax(4.85rem,1.12fr)_minmax(4.85rem,1.12fr)_3.15rem] grid-rows-[auto_auto] items-start gap-x-2 gap-y-2.5 py-3 text-[11px]";

/** Desktop columns: merchant | note (fixed) | payment | pay | receive | gap | action */
export const OFFER_ROW_GRID_CLASS =
  "md:grid-cols-[minmax(0,19rem)_10rem_11.25rem_8rem_8rem_minmax(5.5rem,1.5fr)_9.5rem] md:items-start md:gap-x-0 md:py-4 md:text-[13px]";

const PAYMENT_METHOD_CLASS =
  "text-[14px] font-extrabold uppercase leading-snug tracking-[0.04em] text-white line-clamp-3 break-words max-md:text-[10px] max-md:font-bold max-md:leading-tight max-md:line-clamp-2";

const DETAIL_GAP = "md:pl-4";

const AMOUNT_VALUE_CLASS =
  "w-full min-w-0 tabular-nums text-[15px] font-bold leading-tight tracking-tight text-white max-md:text-[10px] max-md:font-semibold max-md:leading-snug";

const TRADE_BTN_CLASS =
  "inline-flex w-full items-center justify-center gap-1 rounded-xl px-2 py-2 text-center font-extrabold uppercase tracking-wide text-white transition disabled:pointer-events-none disabled:opacity-40 max-md:min-h-[2.125rem] max-md:flex-col max-md:gap-0 max-md:rounded-lg max-md:py-1.5 max-md:text-[8px] max-md:leading-tight md:min-h-[44px] md:flex-row md:gap-1 md:rounded-xl md:px-4 md:py-2.5 md:text-[12px] md:max-w-[9.5rem]";

const NOTE_BOX_CLASS =
  "mt-1.5 flex min-h-[2.75rem] items-center justify-center rounded-lg border border-[#D4AF37]/22 bg-[#D4AF37]/10 px-2.5 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-[#D4AF37]/18 md:min-h-[3rem]";

function OfferDetailCol({
  label,
  mobileLabel,
  children,
  sub,
  className = "",
}: {
  label: string;
  mobileLabel?: string;
  children: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col items-start ${className}`} role="group">
      <p className={DETAIL_LABEL}>
        {mobileLabel ? (
          <>
            <span className="md:hidden">{mobileLabel}</span>
            <span className="hidden md:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </p>
      <div className="mt-1.5 w-full min-w-0 max-md:mt-0.5">{children}</div>
      {sub ? (
        <p className="mt-1 max-w-full text-[10px] leading-snug text-zinc-500 max-md:hidden">{sub}</p>
      ) : null}
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

  const fiatPerCrypto = offerFiatPerOneCrypto(offerAsset, fiatCode, ratePct, row.side, rates);

  const paymentMethods = formatPaymentMethodsCompact(row.payment_methods);
  const advertText = row.advert_message?.trim() ? row.advert_message.trim().toUpperCase() : null;

  const primaryLabel = flow === "buy" ? "Buy" : "Sell";
  const payLabel = flow === "buy" ? `Pay (${browsingMode ? "from " : ""}${fiatCode})` : "Escrow lock";
  const receiveLabel = flow === "buy" ? "Receive" : `Receive (${fiatCode})`;
  const payLabelMobile = flow === "buy" ? `Pay` : "Lock";
  const receiveLabelMobile = flow === "buy" ? "Get" : fiatCode;

  const btnBuyClass = `${TRADE_BTN_CLASS} bg-emerald-600 ring-1 ring-emerald-400/35 hover:bg-emerald-500`;
  const btnSellClass = `${TRADE_BTN_CLASS} bg-red-600 ring-1 ring-red-400/35 hover:bg-red-500`;

  return (
    <article
      aria-label={`Offer from ${name}`}
      className={`grid border-b border-white/[0.07] px-3 text-zinc-200 last:border-b-0 sm:px-6 ${OFFER_MOBILE_GRID_CLASS} ${OFFER_ROW_GRID_CLASS}`}
    >
      <div className="flex min-w-0 items-start gap-2 max-md:col-span-4 max-md:row-start-1 md:col-span-1 md:row-start-auto md:min-h-[4.75rem] md:gap-3">
        <MerchantOfferAvatar
          avatarUrl={row.merchant_avatar_url}
          displayName={name}
          size="sm"
          className="shrink-0 max-md:h-8 max-md:w-8 max-md:text-[9px]"
        />
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-[15px] font-bold leading-[15px] tracking-tight text-[#F5E6B3] max-md:text-[12px] max-md:leading-tight"
            title={name}
          >
            {name}
          </h3>
          <div className="mt-1.5 max-md:mt-0.5">
            <p
              className={`flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide max-md:gap-1 max-md:text-[9px] ${
                presence.online ? "text-emerald-300" : "text-yellow-300"
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full max-md:h-1.5 max-md:w-1.5 ${
                  presence.online
                    ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.75)]"
                    : "bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.65)]"
                }`}
                aria-hidden
              />
              {presence.primary}
            </p>
            {presence.secondary ? (
              <p className="mt-0.5 pl-3.5 text-[10px] font-medium tabular-nums text-zinc-500 max-md:hidden">
                {presence.secondary}
              </p>
            ) : null}
          </div>
          <p className="mt-1 text-[12px] font-semibold tabular-nums text-zinc-300 max-md:mt-0.5 max-md:text-[9px] max-md:leading-tight">
            {formatFiat(minFiat, fiatCode)} – {formatFiat(maxFiat, fiatCode)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 max-md:mt-1 max-md:gap-1">
            <OfferUnitPrice fiatPerCrypto={fiatPerCrypto} fiatCode={fiatCode} asset={offerAsset} />
            <RateVsMpBadge ratePct={ratePct} />
          </div>
        </div>
      </div>

      <div
        className="hidden md:flex md:min-h-[4.75rem] md:w-full md:flex-col md:px-3"
        title={row.advert_message ?? undefined}
      >
        <p className={DETAIL_LABEL}>Note</p>
        <div
          className={`${NOTE_BOX_CLASS} w-full`}
          aria-label={advertText ? `Note: ${advertText}` : "No merchant note"}
        >
          {advertText ? (
            <p className="w-full text-[10px] font-bold uppercase leading-snug tracking-[0.1em] text-[#F5E6B3]">
              {advertText}
            </p>
          ) : (
            <p className="w-full text-[10px] font-semibold uppercase leading-snug tracking-[0.14em] text-[#D4AF37]/30">
              Merchant note
            </p>
          )}
        </div>
      </div>

      <OfferDetailCol
        label="Payment"
        mobileLabel="Method"
        className={`max-md:col-start-1 max-md:row-start-2 md:col-start-3 md:row-start-auto ${DETAIL_GAP}`}
      >
        <p className={PAYMENT_METHOD_CLASS} title={paymentMethods.title || paymentMethods.display}>
          {paymentMethods.display}
        </p>
      </OfferDetailCol>

      <OfferDetailCol
        label={payLabel}
        mobileLabel={payLabelMobile}
        className={`max-md:col-start-2 max-md:row-start-2 md:col-start-4 md:row-start-auto ${DETAIL_GAP}`}
        sub={
          flow === "buy"
            ? `≈ ${fmtAssetAmount(offerAsset, clampedCrypto)} · settle off-platform`
            : `${ratePct >= 0 ? "Above MP — lock less" : "Below MP — lock more"} · after fiat settles`
        }
      >
        <p className={AMOUNT_VALUE_CLASS}>
          {flow === "buy" ? formatFiat(clampedFiat, fiatCode) : fmtAssetAmount(offerAsset, sellLockCrypto)}
        </p>
      </OfferDetailCol>

      <OfferDetailCol
        label={receiveLabel}
        mobileLabel={receiveLabelMobile}
        className={`max-md:col-start-3 max-md:row-start-2 md:col-start-5 md:row-start-auto ${DETAIL_GAP}`}
        sub={flow === "buy" ? "After rate vs MP on sampled size" : "Merchant sends fiat after release"}
      >
        <p className={AMOUNT_VALUE_CLASS}>
          {flow === "buy" ? `≈ ${fmtAssetAmount(offerAsset, netCrypto)}` : formatFiat(clampedFiat, fiatCode)}
        </p>
      </OfferDetailCol>

      <div className="hidden md:block" aria-hidden />

      <div className="flex min-w-0 flex-col items-stretch max-md:col-start-4 max-md:row-start-2 max-md:justify-start md:col-start-auto md:row-start-auto md:items-end">
        <p className={`${DETAIL_LABEL} hidden md:block`} aria-hidden>
          &nbsp;
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={onTrade}
          className={`max-md:mt-0 md:mt-1.5 ${flow === "buy" ? btnBuyClass : btnSellClass}`}
        >
          {busy ? (
            "…"
          ) : (
            <>
              <span>{primaryLabel}</span>
              <span className="tabular-nums text-[11px] font-bold opacity-95 max-md:text-[7px] max-md:opacity-90">
                {offerAsset}
              </span>
            </>
          )}
        </button>
      </div>
    </article>
  );
}
