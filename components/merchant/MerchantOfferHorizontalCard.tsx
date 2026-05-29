"use client";

import Link from "next/link";
import { Pencil, Power, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { offerAssetLabel } from "@/components/merchant/merchantOfferSide";
import { MerchantOfferAvatar } from "@/components/p2p/MerchantOfferAvatar";
import { paymentMethodLabel } from "@/components/p2p/utils";
import { formatMoneyAmount } from "@/lib/formatMoney";

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

const STRIP_GRID =
  "grid w-full min-w-0 grid-cols-[3rem_minmax(0,0.95fr)_minmax(0,0.8fr)_minmax(0,1.65fr)_minmax(0,1.05fr)_minmax(0,1.55fr)_7.5rem] items-center gap-x-4 px-5 sm:gap-x-5";

const STRIP_ROW = `${STRIP_GRID} min-h-[4.75rem] border-b border-white/[0.07] bg-[#070b12]/55 py-3.5 text-[14px] text-zinc-200 last:border-b-0`;

const HEADER_ROW = `${STRIP_GRID} sticky top-0 z-10 border-b border-white/[0.14] bg-[#05080F]/96 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 backdrop-blur-md`;

const VALUE_TEXT = "text-[15px] font-semibold leading-snug text-zinc-100";

const FIELD_BOX =
  "w-full rounded-xl border border-white/[0.055] bg-[#0a0e16]/90 px-3.5 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]";

const FIELD_BOX_BTN = `${FIELD_BOX} touch-manipulation transition duration-200 hover:border-white/[0.09] hover:bg-[#0c111a] disabled:opacity-50`;

const FIELD_BOX_BTN_TOUCH = `${FIELD_BOX_BTN} min-h-[44px] py-3 lg:min-h-0 lg:py-2.5`;

const FIELD_INPUT = `${FIELD_BOX} min-h-[44px] touch-manipulation text-[14px] font-semibold text-zinc-100 outline-none focus:border-white/[0.11] focus:bg-[#0c111a] focus:ring-1 focus:ring-white/[0.06] lg:min-h-0`;

const CHIP_SOFT =
  "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ring-1";

const MOBILE_TOUCH = "[&_button]:min-h-[44px] [&_button]:touch-manipulation [&_input]:min-h-[44px]";

function StripValue({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex min-w-0 items-center ${className}`}>{children}</div>;
}

function MobileLabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={`space-y-1.5 ${MOBILE_TOUCH}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <div className="w-full min-w-0">{children}</div>
    </div>
  );
}

function StripFieldBox({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${FIELD_BOX} ${className}`}>{children}</div>;
}

export function formatOfferLimitDisplay(fiat: string, min: number, max: number): string {
  return `${fiat.toUpperCase()} (${formatMoneyAmount(min)} – ${formatMoneyAmount(max)})`;
}

function parseMoneyToken(raw: string): number | null {
  const n = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseOfferLimitDraft(
  draft: string,
  fallbackFiat: string,
): { fiat: string; min: number; max: number } | string {
  const trimmed = draft.trim();
  if (!trimmed) return "Enter a limit like USD (200-599).";

  const match = trimmed.match(/^([A-Za-z]{3})\s*\(\s*([\d.,]+)\s*[-–]\s*([\d.,]+)\s*\)\s*$/);
  if (!match) return "Use format: USD (200-599) or KES (2,000-5,000).";

  const fiat = match[1].toUpperCase();
  const min = parseMoneyToken(match[2]);
  const max = parseMoneyToken(match[3]);
  if (min === null || max === null) return "Min and max must be valid numbers.";
  if (min > max) return "Min cannot exceed max.";
  if (fiat !== fallbackFiat.toUpperCase()) {
    return `Currency must stay ${fallbackFiat.toUpperCase()} for this listing.`;
  }
  return { fiat, min, max };
}

function LimitBoxContent({ fiat, min, max }: { fiat: string; min: number; max: number }) {
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
        {fiat.toUpperCase()}
      </span>
      <span className={`min-w-0 break-words tabular-nums lg:truncate ${VALUE_TEXT}`}>
        ({formatMoneyAmount(min)}
        <span className="mx-1 font-normal text-zinc-500">–</span>
        {formatMoneyAmount(max)})
      </span>
    </span>
  );
}

function IconBtn({
  label,
  onClick,
  href,
  tone,
  children,
  className = "",
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  tone: "gold" | "green" | "red";
  children: ReactNode;
  className?: string;
}) {
  const toneCls =
    tone === "gold"
      ? "text-[#D4AF37] hover:bg-[#D4AF37]/14 hover:text-[#F5E6B3] active:bg-[#D4AF37]/20"
      : tone === "green"
        ? "text-emerald-400 hover:bg-emerald-500/18 hover:text-emerald-100 active:bg-emerald-500/22"
        : "text-red-400 hover:bg-red-500/14 hover:text-red-200 active:bg-red-500/20";

  const cls = `inline-flex shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-[#0a0e16]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] touch-manipulation transition ${toneCls} ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls} aria-label={label} title={label}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cls} aria-label={label} title={label}>
      {children}
    </button>
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
  const icon = "h-[18px] w-[18px]";
  return (
    <>
      <div className="hidden items-center justify-end gap-2 lg:flex">
        <IconBtn label="Edit listing" href={`/merchant/offers/${offerId}/edit`} tone="gold" className="h-10 w-10">
          <Pencil className={icon} strokeWidth={2} aria-hidden />
        </IconBtn>
        <IconBtn
          label={isActive ? "Pause listing" : "Activate listing"}
          onClick={onToggleActive}
          tone="green"
          className="h-10 w-10"
        >
          <Power className={`${icon} ${isActive ? "" : "opacity-50"}`} strokeWidth={2} aria-hidden />
        </IconBtn>
        <IconBtn label="Delete listing" onClick={onDelete} tone="red" className="h-10 w-10">
          <Trash2 className={icon} strokeWidth={2} aria-hidden />
        </IconBtn>
      </div>
      <div className="grid grid-cols-3 gap-2 lg:hidden">
        <IconBtn
          label="Edit listing"
          href={`/merchant/offers/${offerId}/edit`}
          tone="gold"
          className="h-11 w-full min-h-[44px]"
        >
          <Pencil className={icon} strokeWidth={2} aria-hidden />
        </IconBtn>
        <IconBtn
          label={isActive ? "Pause listing" : "Activate listing"}
          onClick={onToggleActive}
          tone="green"
          className="h-11 w-full min-h-[44px]"
        >
          <Power className={`${icon} ${isActive ? "" : "opacity-50"}`} strokeWidth={2} aria-hidden />
        </IconBtn>
        <IconBtn label="Delete listing" onClick={onDelete} tone="red" className="h-11 w-full min-h-[44px]">
          <Trash2 className={icon} strokeWidth={2} aria-hidden />
        </IconBtn>
      </div>
    </>
  );
}

function EditableMetric({
  label,
  value,
  suffix,
  disabled,
  onCommit,
  touchFriendly,
}: {
  label: string;
  value: number;
  suffix?: string;
  disabled?: boolean;
  onCommit: (next: number) => Promise<void>;
  touchFriendly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const btnCls = touchFriendly ? FIELD_BOX_BTN_TOUCH : FIELD_BOX_BTN;

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

  const display =
    suffix === "%" ? `${value}%` : `${formatMoneyAmount(value)}${suffix && suffix !== "%" ? ` ${suffix}` : ""}`;

  if (editing) {
    return (
      <StripValue className="w-full">
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
          className={`${FIELD_INPUT} tabular-nums`}
        />
      </StripValue>
    );
  }

  return (
    <StripValue className="w-full">
      <button
        type="button"
        disabled={disabled || saving}
        aria-label={`Edit ${label}`}
        onClick={() => setEditing(true)}
        className={`${btnCls} min-w-0 truncate text-left tabular-nums ${VALUE_TEXT}`}
        title={`Tap to edit ${label.toLowerCase()}`}
      >
        {display}
      </button>
    </StripValue>
  );
}

function EditableLimit({
  fiat,
  min,
  max,
  onCommit,
  touchFriendly,
}: {
  fiat: string;
  min: number;
  max: number;
  onCommit: (next: { min: number; max: number }) => Promise<string | null>;
  touchFriendly?: boolean;
}) {
  const display = formatOfferLimitDisplay(fiat, min, max);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(display);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const btnCls = touchFriendly ? FIELD_BOX_BTN_TOUCH : FIELD_BOX_BTN;

  useEffect(() => {
    if (!editing) setDraft(formatOfferLimitDisplay(fiat, min, max));
  }, [fiat, min, max, editing]);

  const commit = useCallback(async () => {
    const parsed = parseOfferLimitDraft(draft, fiat);
    if (typeof parsed === "string") {
      setHint(parsed);
      return;
    }
    setHint(null);
    if (parsed.min === min && parsed.max === max) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const errMsg = await onCommit({ min: parsed.min, max: parsed.max });
    setSaving(false);
    if (errMsg) {
      setHint(errMsg);
      return;
    }
    setEditing(false);
  }, [draft, fiat, min, max, onCommit]);

  if (editing) {
    return (
      <StripValue className="w-full flex-col items-stretch gap-1.5">
        <input
          type="text"
          autoFocus
          disabled={saving}
          aria-label="Edit limit"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setHint(null);
          }}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") {
              setDraft(display);
              setHint(null);
              setEditing(false);
            }
          }}
          placeholder="USD (200 – 599)"
          className={`${FIELD_INPUT} uppercase tracking-wide`}
        />
        {hint ? <span className="text-[11px] leading-snug text-red-300/90">{hint}</span> : null}
      </StripValue>
    );
  }

  return (
    <StripValue className="w-full">
      <button
        type="button"
        disabled={saving}
        aria-label="Edit limit"
        onClick={() => setEditing(true)}
        className={`${btnCls} w-full text-left`}
        title="Tap to edit limit"
      >
        <LimitBoxContent fiat={fiat} min={min} max={max} />
      </button>
    </StripValue>
  );
}

function EditableNote({
  value,
  onCommit,
  touchFriendly,
}: {
  value: string | null;
  onCommit: (next: string | null) => Promise<void>;
  touchFriendly?: boolean;
}) {
  const shown = value?.trim() ? value.trim().toUpperCase() : null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(shown ?? "");
  const [saving, setSaving] = useState(false);
  const btnCls = touchFriendly ? FIELD_BOX_BTN_TOUCH : FIELD_BOX_BTN;

  useEffect(() => {
    if (!editing) setDraft(shown ?? "");
  }, [shown, editing]);

  const commit = useCallback(async () => {
    const next = draft.trim() ? draft.trim().toUpperCase().slice(0, 500) : null;
    const prev = shown;
    if (next === prev) {
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
      <StripValue className="w-full">
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
          className={`${FIELD_INPUT} uppercase tracking-[0.06em] placeholder:text-zinc-600`}
        />
      </StripValue>
    );
  }

  return (
    <StripValue className="w-full">
      <button
        type="button"
        disabled={saving}
        aria-label="Edit note"
        onClick={() => setEditing(true)}
        className={`${btnCls} w-full text-left`}
        title="Tap to edit note"
      >
        <span
          className={`block min-w-0 text-[13px] font-semibold uppercase tracking-[0.06em] ${
            touchFriendly ? "line-clamp-3 break-words" : "truncate"
          } ${shown ? "text-zinc-200" : "text-zinc-600"}`}
        >
          {shown || "—"}
        </span>
      </button>
    </StripValue>
  );
}

/** Column labels — desktop strip only. */
export function MerchantOffersStripHeader() {
  return (
    <div className={`${HEADER_ROW} hidden lg:grid`} aria-hidden>
      <span />
      <span className="min-w-0 truncate">Asset</span>
      <span className="min-w-0 truncate">Rate</span>
      <span className="min-w-0 truncate">Limit</span>
      <span className="min-w-0 truncate">Pay</span>
      <span className="min-w-0 truncate">Note</span>
      <span className="text-right">Actions</span>
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
  const methodsDisplay = offer.payment_methods.map((c) => paymentMethodLabel(c)).join(" · ") || "—";
  const isActive = offer.status === "active";
  const fiat = (offer.fiat_currency_code ?? "USD").toUpperCase();
  const asset = offerAssetLabel(offer.side);

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
          ? "bg-emerald-500/22 text-emerald-50 ring-emerald-400/40"
          : "bg-zinc-700/35 text-zinc-400 ring-zinc-600/50"
      }`}
    >
      {offer.status}
    </span>
  );

  const onRateCommit = async (n: number) => {
    await persist({ rate_percentage: n });
  };
  const onLimitCommit = async ({ min, max }: { min: number; max: number }) =>
    persist({ min_limit: min, max_limit: max });
  const onNoteCommit = async (advert_message: string | null) => {
    await persist({ advert_message });
  };

  const rateFieldMobile = (
    <EditableMetric label="Rate" value={offer.rate_percentage} suffix="%" touchFriendly onCommit={onRateCommit} />
  );
  const rateFieldDesktop = (
    <EditableMetric label="Rate" value={offer.rate_percentage} suffix="%" onCommit={onRateCommit} />
  );

  const limitFieldMobile = (
    <EditableLimit
      fiat={fiat}
      min={offer.min_limit}
      max={offer.max_limit}
      touchFriendly
      onCommit={onLimitCommit}
    />
  );
  const limitFieldDesktop = (
    <EditableLimit fiat={fiat} min={offer.min_limit} max={offer.max_limit} onCommit={onLimitCommit} />
  );

  const payFieldMobile = (
    <StripFieldBox className="min-h-[44px] py-3">
      <p
        className="text-[13px] font-medium uppercase leading-snug tracking-[0.05em] text-zinc-300"
        title={methodsDisplay}
      >
        {methodsDisplay}
      </p>
    </StripFieldBox>
  );
  const payFieldDesktop = (
    <StripFieldBox>
      <p
        className="min-w-0 truncate text-[13px] font-medium uppercase tracking-[0.05em] text-zinc-300"
        title={methodsDisplay}
      >
        {methodsDisplay}
      </p>
    </StripFieldBox>
  );

  const noteFieldMobile = <EditableNote value={offer.advert_message} touchFriendly onCommit={onNoteCommit} />;
  const noteFieldDesktop = <EditableNote value={offer.advert_message} onCommit={onNoteCommit} />;

  const actions = (
    <OfferActionButtons
      offerId={offer.id}
      isActive={isActive}
      onToggleActive={onToggleActive}
      onDelete={onDelete}
    />
  );

  return (
    <>
      {/* Mobile: stacked card — no horizontal scroll, full-width tap targets */}
      <article
        aria-label={`${asset} offer ${offer.status}`}
        className="flex flex-col gap-3.5 border-b border-white/[0.07] bg-[#070b12]/55 p-4 last:border-b-0 lg:hidden"
      >
        <div className="flex items-center gap-3">
          <MerchantOfferAvatar
            avatarUrl={merchantAvatarUrl}
            displayName={merchantDisplayName ?? asset}
            size="md"
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-extrabold uppercase tracking-[0.08em] text-[#F5E6B3]">{asset}</p>
            <div className="mt-1.5">{statusChip}</div>
          </div>
        </div>

        <div className={`grid grid-cols-1 gap-3 ${MOBILE_TOUCH}`}>
          <MobileLabeledField label="Rate">{rateFieldMobile}</MobileLabeledField>
          <MobileLabeledField label="Limit">{limitFieldMobile}</MobileLabeledField>
          <MobileLabeledField label="Pay">{payFieldMobile}</MobileLabeledField>
          <MobileLabeledField label="Note">{noteFieldMobile}</MobileLabeledField>
        </div>

        {actions}
      </article>

      {/* Desktop: horizontal aligned strip */}
      <article aria-label={`${asset} offer ${offer.status}`} className={`${STRIP_ROW} hidden lg:grid`}>
        <MerchantOfferAvatar
          avatarUrl={merchantAvatarUrl}
          displayName={merchantDisplayName ?? asset}
          size="md"
          className="shrink-0"
        />

        <StripValue className="min-w-0 gap-2.5">
          <p className="shrink-0 text-[15px] font-extrabold uppercase tracking-[0.08em] text-[#F5E6B3]">{asset}</p>
          {statusChip}
        </StripValue>

        {rateFieldDesktop}
        {limitFieldDesktop}
        <StripValue>{payFieldDesktop}</StripValue>
        {noteFieldDesktop}
        {actions}
      </article>
    </>
  );
}
