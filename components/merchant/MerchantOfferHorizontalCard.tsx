"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { offerAssetLabel } from "@/components/merchant/merchantOfferSide";
import { MerchantOfferAvatar } from "@/components/p2p/MerchantOfferAvatar";
import { paymentMethodLabelCaps } from "@/components/p2p/utils";
import { formatFiat } from "@/lib/currencies";
import { formatMoneyAmount } from "@/lib/formatMoney";
import { assetFromOfferSide } from "@/lib/p2pAssets";
import { formatOfferUnitPriceAmount, offerFiatPerOneCrypto } from "@/lib/p2pValue";
import { useFxRates } from "@/lib/useFx";

export type MerchantOfferHorizontalRow = {
  id: string;
  side: string;
  status: string;
  min_limit: number;
  max_limit: number;
  rate_percentage: number;
  payment_methods: string[];
  payment_instructions: string | null;
  advert_message: string | null;
  fiat_currency_code: string | null;
};

export type MerchantOfferQuickSavePatch = {
  rate_percentage: number;
  min_limit: number;
  max_limit: number;
  advert_message: string | null;
};

type MerchantOfferHorizontalCardProps = {
  offer: MerchantOfferHorizontalRow;
  merchantAvatarUrl?: string | null;
  merchantDisplayName?: string | null;
  onToggleActive: () => void;
  onDelete: () => void;
  onQuickSave: (offerId: string, patch: MerchantOfferQuickSavePatch) => Promise<string | null>;
};

const DETAIL_LABEL =
  "text-[10px] font-semibold uppercase tracking-[0.12em] leading-[15px] text-zinc-500 max-md:text-[8px] max-md:tracking-[0.08em] max-md:leading-none";

const MERCHANT_OFFER_MOBILE_GRID =
  "grid grid-cols-[minmax(0,1fr)_minmax(3.75rem,0.9fr)_minmax(5.5rem,1.15fr)_auto] grid-rows-[auto_auto] items-start gap-x-2 gap-y-2.5 py-3 text-[11px]";

/** asset | note | payment | rate | limits | flex gap | actions */
const MERCHANT_OFFER_ROW_GRID =
  "md:grid-cols-[minmax(0,20rem)_9rem_8.5rem_5rem_minmax(14rem,17rem)_minmax(2.5rem,1fr)_auto] md:items-start md:gap-x-0 md:py-4 md:text-[13px]";

const PAYMENT_METHOD_CLASS =
  "text-[14px] font-extrabold uppercase leading-snug tracking-[0.04em] text-white line-clamp-3 break-words max-md:text-[10px] max-md:font-bold max-md:leading-tight max-md:line-clamp-2";

const AMOUNT_VALUE_CLASS =
  "w-full min-w-0 tabular-nums text-[15px] font-bold leading-tight tracking-tight text-white max-md:text-[10px] max-md:font-semibold max-md:leading-snug";

const NOTE_BOX_CLASS =
  "mt-1.5 flex min-h-[2.75rem] items-center justify-center rounded-lg border border-[#D4AF37]/22 bg-[#D4AF37]/10 px-2.5 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-[#D4AF37]/18 md:min-h-[3rem]";

const DETAIL_GAP = "md:pl-5";

const CHIP_SOFT =
  "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ring-1 max-md:text-[8px]";

function OfferDetailCol({
  label,
  mobileLabel,
  children,
  className = "",
}: {
  label: string;
  mobileLabel?: string;
  children: ReactNode;
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
    </div>
  );
}

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
    >
      {aboveMp ? (
        <ArrowUp className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
      ) : (
        <ArrowDown className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
      )}
      <span>{signed}</span>
      <span className="hidden text-[9px] font-semibold uppercase tracking-wide opacity-90 md:inline">
        {aboveMp ? "above MP" : "below MP"}
      </span>
    </span>
  );
}

function formatPaymentMethodsCompact(methods: string[]): { display: string; title: string } {
  const labels = methods.map((c) => paymentMethodLabelCaps(c)).filter(Boolean);
  if (labels.length === 0) return { display: "—", title: "" };
  const title = labels.join(" · ");
  if (labels.length <= 2) return { display: labels.join(" · "), title };
  const rest = labels.length - 2;
  return {
    display: `${labels.slice(0, 2).join(" · ")} · +${rest} other${rest === 1 ? "" : "s"}`,
    title,
  };
}

function RowEditableNumber({
  label,
  value,
  suffix,
  onCommit,
  className = AMOUNT_VALUE_CLASS,
  inline = false,
}: {
  label: string;
  value: number;
  suffix?: string;
  onCommit: (next: number) => Promise<void>;
  className?: string;
  inline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = useCallback(async () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(String(value));
      setEditing(false);
      return;
    }
    if (parsed === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onCommit(parsed);
    setSaving(false);
    setEditing(false);
  }, [draft, onCommit, value]);

  const display = suffix === "%" ? `${value}%` : formatMoneyAmount(value);

  if (editing) {
    return (
      <input
        type="number"
        step="any"
        autoFocus
        disabled={saving}
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className={`w-full min-w-0 rounded-lg border border-white/[0.1] bg-[#0a0e16]/90 px-2.5 py-1.5 text-[13px] font-bold tabular-nums text-white outline-none focus:border-[#D4AF37]/40 max-md:text-[11px] ${inline ? "min-w-[4.5rem]" : ""}`}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={saving}
      aria-label={`Edit ${label}`}
      onClick={() => setEditing(true)}
      className={`${className} ${inline ? "inline min-w-0" : "block w-full min-w-0"} text-left transition hover:text-[#F5E6B3]`}
      title={`Click to edit ${label.toLowerCase()}`}
    >
      {display}
    </button>
  );
}

function RowEditableNote({
  value,
  onCommit,
}: {
  value: string | null;
  onCommit: (next: string | null) => Promise<void>;
}) {
  const shown = value?.trim() ? value.trim().toUpperCase() : null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(shown ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(shown ?? "");
  }, [shown, editing]);

  const commit = useCallback(async () => {
    const next = draft.trim() ? draft.trim().toUpperCase().slice(0, 500) : null;
    if (next === shown) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onCommit(next);
    setSaving(false);
    setEditing(false);
  }, [draft, onCommit, shown]);

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        disabled={saving}
        aria-label="Edit note"
        value={draft}
        onChange={(e) => setDraft(e.target.value.toUpperCase())}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") {
            setDraft(shown ?? "");
            setEditing(false);
          }
        }}
        placeholder="YOUR NOTE"
        className="w-full rounded-lg border border-[#D4AF37]/35 bg-[#0a0e16]/90 px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#F5E6B3] outline-none focus:border-[#D4AF37]/55"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={saving}
      aria-label="Edit note"
      onClick={() => setEditing(true)}
      className={`${NOTE_BOX_CLASS} w-full cursor-pointer transition hover:border-[#D4AF37]/40`}
      title="Click to edit note"
    >
      {shown ? (
        <p className="w-full text-[10px] font-bold uppercase leading-snug tracking-[0.1em] text-[#F5E6B3]">
          {shown}
        </p>
      ) : (
        <p className="w-full text-[10px] font-semibold uppercase leading-snug tracking-[0.14em] text-[#D4AF37]/30">
          Add note
        </p>
      )}
    </button>
  );
}

function OfferActiveToggle({
  isActive,
  onToggle,
}: {
  isActive: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isActive}
      aria-label={isActive ? "Listing active — turn off" : "Listing paused — turn on"}
      onClick={onToggle}
      className={`relative inline-flex h-7 w-[3.25rem] shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 ${
        isActive ? "bg-[#3B82F6]" : "bg-[#6B7280]"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-[1.375rem] w-[1.375rem] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.35)] transition-transform duration-200 ${
          isActive ? "translate-x-[1.625rem]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function OfferEditMenu({
  offerId,
  onDelete,
}: {
  offerId: string;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex min-h-[36px] min-w-[4.5rem] items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-xs font-semibold text-zinc-200 transition hover:border-[#D4AF37]/35 hover:text-[#F5E6B3] max-md:min-h-[32px] max-md:px-3 max-md:text-[11px]"
      >
        Edit
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1.5 min-w-[11rem] overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c111a] py-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.06]"
        >
          <Link
            href={`/merchant/offers/${offerId}/edit`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-left text-xs font-medium text-zinc-200 transition hover:bg-white/[0.05] hover:text-[#F5E6B3]"
          >
            Make changes
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="block w-full px-4 py-2.5 text-left text-xs font-medium text-red-300 transition hover:bg-red-500/10"
          >
            Delete offer
          </button>
        </div>
      ) : null}
    </div>
  );
}

function OfferActionButtons({
  offerId,
  isActive,
  onToggleActive,
  onDelete,
}: {
  offerId: string;
  isActive: boolean;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-row items-center gap-3 max-md:gap-2">
      <OfferEditMenu offerId={offerId} onDelete={onDelete} />
      <OfferActiveToggle isActive={isActive} onToggle={onToggleActive} />
    </div>
  );
}

export function MerchantOfferHorizontalCard({
  offer,
  merchantAvatarUrl,
  merchantDisplayName,
  onToggleActive,
  onDelete,
  onQuickSave,
}: MerchantOfferHorizontalCardProps) {
  const { rates } = useFxRates();
  const methodsDisplay = formatPaymentMethodsCompact(offer.payment_methods);
  const isActive = offer.status === "active";
  const fiat = (offer.fiat_currency_code ?? "USD").toUpperCase();
  const asset = offerAssetLabel(offer.side);
  const offerAsset = assetFromOfferSide(offer.side);
  const ratePct = Number(offer.rate_percentage) || 0;
  const fiatPerCrypto = offerFiatPerOneCrypto(offerAsset, fiat, ratePct, offer.side, rates);
  const unitPrice = formatOfferUnitPriceAmount(fiatPerCrypto, fiat);
  const isSellSide = offer.side === "sell_usdt" || offer.side === "sell_btc";
  const name = merchantDisplayName || "Merchant";

  const persist = useCallback(
    async (
      patch: Partial<{
        rate_percentage: number;
        min_limit: number;
        max_limit: number;
        advert_message: string | null;
      }>,
    ) => {
      const next = {
        rate_percentage: patch.rate_percentage ?? offer.rate_percentage,
        min_limit: patch.min_limit ?? offer.min_limit,
        max_limit: patch.max_limit ?? offer.max_limit,
        advert_message: patch.advert_message !== undefined ? patch.advert_message : offer.advert_message,
      };
      if (next.min_limit > next.max_limit) {
        return "Min limit cannot exceed max limit.";
      }
      return onQuickSave(offer.id, next);
    },
    [offer, onQuickSave],
  );

  const statusChip = (
    <span
      className={`${CHIP_SOFT} ${
        isActive
          ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/35"
          : "bg-zinc-700/35 text-zinc-400 ring-zinc-600/50"
      }`}
    >
      {offer.status}
    </span>
  );

  const sideChip = (
    <span
      className={`${CHIP_SOFT} ${
        isSellSide
          ? "bg-red-500/15 text-red-200 ring-red-400/35"
          : "bg-emerald-500/15 text-emerald-200 ring-emerald-400/35"
      }`}
    >
      {isSellSide ? "Sell" : "Buy"}
    </span>
  );

  return (
    <article
      aria-label={`${asset} offer ${offer.status}`}
      className={`grid border-b border-white/[0.06] px-3 text-zinc-200 transition-colors last:border-b-0 hover:bg-white/[0.02] sm:px-6 ${MERCHANT_OFFER_MOBILE_GRID} ${MERCHANT_OFFER_ROW_GRID}`}
    >
      {/* Col 1 — asset identity (mirrors buyer merchant column) */}
      <div className="grid max-md:col-span-4 max-md:row-start-1 md:col-span-1 md:row-start-auto md:pr-2 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2.5 gap-y-0">
        <MerchantOfferAvatar
          avatarUrl={merchantAvatarUrl}
          displayName={name}
          size="sm"
          className="row-start-1 shrink-0 self-center max-md:h-8 max-md:w-8 max-md:text-[9px]"
        />
        <div className="col-start-2 row-start-1 flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h3 className="m-0 shrink-0 text-[15px] font-bold leading-tight tracking-tight text-white max-md:text-[13px]">
              {asset}
            </h3>
            {sideChip}
            {statusChip}
          </div>
          <p className="text-[11px] font-medium text-zinc-500 max-md:text-[9px]">{name}</p>
        </div>
        <p className="col-start-2 row-start-2 mt-2 text-[12px] font-semibold tabular-nums text-zinc-300 max-md:mt-1.5 max-md:text-[9px] max-md:leading-tight">
          {formatFiat(offer.min_limit, fiat)} – {formatFiat(offer.max_limit, fiat)}
        </p>
        <div className="col-start-2 row-start-3 mt-1.5 flex flex-wrap items-center gap-1.5 max-md:mt-1 max-md:gap-1">
          <span
            className="inline-flex w-fit shrink-0 items-baseline gap-0.5 rounded-md border border-white/[0.06] bg-[#0a0e16]/80 px-2 py-1 tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-white/[0.04] max-md:px-1.5 max-md:py-0.5"
            title={`${unitPrice} ${fiat} per 1 ${asset}`}
          >
            <span className="text-[17px] font-bold leading-none tracking-tight text-white max-md:text-[12px]">
              {unitPrice}
            </span>
            <span className="pb-px text-[10px] font-semibold uppercase tracking-wide text-zinc-500 max-md:text-[8px]">
              /{fiat.toLowerCase()}
            </span>
          </span>
          <RateVsMpBadge ratePct={ratePct} />
        </div>
      </div>

      {/* Col 2 — note (desktop) */}
      <div
        className="hidden md:flex md:min-h-[4.75rem] md:w-full md:flex-col md:px-3"
        title={offer.advert_message ?? undefined}
      >
        <p className={DETAIL_LABEL}>Note</p>
        <RowEditableNote
          value={offer.advert_message}
          onCommit={async (advert_message) => {
            await persist({ advert_message });
          }}
        />
      </div>

      {/* Col 3 — payment */}
      <OfferDetailCol
        label="Payment"
        mobileLabel="Method"
        className={`max-md:col-start-1 max-md:row-start-2 md:col-start-3 md:row-start-auto ${DETAIL_GAP}`}
      >
        <p className={PAYMENT_METHOD_CLASS} title={methodsDisplay.title || methodsDisplay.display}>
          {methodsDisplay.display}
        </p>
      </OfferDetailCol>

      {/* Col 4 — rate */}
      <OfferDetailCol
        label="Rate"
        mobileLabel="Rate"
        className={`max-md:col-start-2 max-md:row-start-2 md:col-start-4 md:row-start-auto ${DETAIL_GAP}`}
      >
        <RowEditableNumber
          label="Rate"
          value={offer.rate_percentage}
          suffix="%"
          onCommit={async (n) => {
            await persist({ rate_percentage: n });
          }}
        />
      </OfferDetailCol>

      {/* Col 5 — limits */}
      <OfferDetailCol
        label={`Limits (${fiat})`}
        mobileLabel="Limits"
        className={`max-md:col-start-3 max-md:row-start-2 md:col-start-5 md:row-start-auto md:-ml-1 md:min-w-[14rem] md:pr-3 ${DETAIL_GAP}`}
      >
        <div className="flex w-full min-w-0 flex-wrap items-baseline gap-x-5 gap-y-1 max-md:gap-x-3">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Min</span>
            <RowEditableNumber
              label="Min limit"
              value={offer.min_limit}
              inline
              onCommit={async (min) => {
                if (min > offer.max_limit) return;
                await persist({ min_limit: min });
              }}
              className="text-[13px] font-bold tabular-nums text-zinc-200 max-md:text-[10px]"
            />
          </div>
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Max</span>
            <RowEditableNumber
              label="Max limit"
              value={offer.max_limit}
              inline
              onCommit={async (max) => {
                if (max < offer.min_limit) return;
                await persist({ max_limit: max });
              }}
              className="text-[13px] font-bold tabular-nums text-zinc-300 max-md:text-[10px]"
            />
          </div>
        </div>
      </OfferDetailCol>

      {/* Col 7 — actions (col 6 is flexible spacer) */}
      <div className="flex min-w-0 flex-col items-stretch max-md:col-start-4 max-md:row-start-2 max-md:justify-center md:col-start-7 md:row-start-auto md:items-end md:justify-center md:justify-self-end md:pl-2">
        <p className={`${DETAIL_LABEL} hidden md:block`} aria-hidden>
          &nbsp;
        </p>
        <div className="max-md:mt-0 md:mt-1.5">
          <OfferActionButtons
            offerId={offer.id}
            isActive={isActive}
            onToggleActive={onToggleActive}
            onDelete={onDelete}
          />
        </div>
      </div>
    </article>
  );
}
