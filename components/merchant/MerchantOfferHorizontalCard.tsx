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

/** Muted inset panel — matches strip background, not loud gold outlines. */
const FIELD_BOX =
  "w-full rounded-xl border border-white/[0.055] bg-[#0a0e16]/90 px-3.5 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]";

const FIELD_BOX_BTN = `${FIELD_BOX} transition duration-200 hover:border-white/[0.09] hover:bg-[#0c111a] disabled:opacity-50`;

const FIELD_INPUT = `${FIELD_BOX} text-[14px] font-semibold text-zinc-100 outline-none focus:border-white/[0.11] focus:bg-[#0c111a] focus:ring-1 focus:ring-white/[0.06]`;

const CHIP_SOFT =
  "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ring-1";

function StripValue({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex min-w-0 items-center ${className}`}>{children}</div>;
}

function StripFieldBox({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${FIELD_BOX} ${className}`}>{children}</div>;
}

export function formatOfferLimitDisplay(fiat: string, min: number, max: number): string {
  return `${fiat.toUpperCase()} (${formatMoneyAmount(min)} – ${formatMoneyAmount(max)})`;
}

function parseMoneyToken(raw: string): number | null {
  const n = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Parse `USD (200-599)` or `KES (2,000-5,000)` when inline-editing limits. */
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
      <span className={`min-w-0 truncate tabular-nums ${VALUE_TEXT}`}>
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
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  tone: "gold" | "green" | "red";
  children: ReactNode;
}) {
  const toneCls =
    tone === "gold"
      ? "text-[#D4AF37] hover:bg-[#D4AF37]/14 hover:text-[#F5E6B3]"
      : tone === "green"
        ? "text-emerald-400 hover:bg-emerald-500/18 hover:text-emerald-100"
        : "text-red-400 hover:bg-red-500/14 hover:text-red-200";

  const cls = `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-[#0a0e16]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition ${toneCls}`;

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

function EditableMetric({
  label,
  value,
  suffix,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  suffix?: string;
  disabled?: boolean;
  onCommit: (next: number) => Promise<void>;
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

  const display =
    suffix === "%" ? `${value}%` : `${formatMoneyAmount(value)}${suffix && suffix !== "%" ? ` ${suffix}` : ""}`;

  if (editing) {
    return (
      <StripValue>
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
    <StripValue>
      <button
        type="button"
        disabled={disabled || saving}
        aria-label={`Edit ${label}`}
        onClick={() => setEditing(true)}
        className={`${FIELD_BOX_BTN} min-w-0 truncate text-left tabular-nums ${VALUE_TEXT}`}
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
}: {
  fiat: string;
  min: number;
  max: number;
  onCommit: (next: { min: number; max: number }) => Promise<string | null>;
}) {
  const display = formatOfferLimitDisplay(fiat, min, max);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(display);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

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
      <StripValue className="flex-col items-stretch gap-1.5">
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
    <StripValue>
      <button
        type="button"
        disabled={saving}
        aria-label="Edit limit"
        onClick={() => setEditing(true)}
        className={FIELD_BOX_BTN}
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
      <StripValue>
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
    <StripValue>
      <button
        type="button"
        disabled={saving}
        aria-label="Edit note"
        onClick={() => setEditing(true)}
        className={FIELD_BOX_BTN}
        title="Tap to edit note"
      >
        <span
          className={`block min-w-0 truncate text-[13px] font-semibold uppercase tracking-[0.06em] ${
            shown ? "text-zinc-200" : "text-zinc-600"
          }`}
        >
          {shown || "—"}
        </span>
      </button>
    </StripValue>
  );
}

/** Column labels aligned to offer rows below. */
export function MerchantOffersStripHeader() {
  return (
    <div className={HEADER_ROW} aria-hidden>
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

/** Full-width horizontal strip — one grid row per offer, columns aligned with the header. */
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

  return (
    <article aria-label={`${asset} offer ${offer.status}`} className={STRIP_ROW}>
      <MerchantOfferAvatar
        avatarUrl={merchantAvatarUrl}
        displayName={merchantDisplayName ?? asset}
        size="md"
        className="shrink-0"
      />

      <StripValue className="min-w-0 gap-2.5">
        <p className={`shrink-0 text-[15px] font-extrabold uppercase tracking-[0.08em] text-[#F5E6B3]`}>{asset}</p>
        <span
          className={`${CHIP_SOFT} ${
            isActive
              ? "bg-emerald-500/22 text-emerald-50 ring-emerald-400/40"
              : "bg-zinc-700/35 text-zinc-400 ring-zinc-600/50"
          }`}
        >
          {offer.status}
        </span>
      </StripValue>

      <EditableMetric label="Rate" value={offer.rate_percentage} suffix="%" onCommit={(n) => persist({ rate_percentage: n })} />

      <EditableLimit
        fiat={fiat}
        min={offer.min_limit}
        max={offer.max_limit}
        onCommit={async ({ min, max }) => persist({ min_limit: min, max_limit: max })}
      />

      <StripValue>
        <StripFieldBox className="min-w-0">
          <p
            className="min-w-0 truncate text-[13px] font-medium uppercase tracking-[0.05em] text-zinc-300"
            title={methodsDisplay}
          >
            {methodsDisplay}
          </p>
        </StripFieldBox>
      </StripValue>

      <EditableNote value={offer.advert_message} onCommit={async (advert_message) => persist({ advert_message })} />

      <div className="flex items-center justify-end gap-2">
        <IconBtn label="Edit listing" href={`/merchant/offers/${offer.id}/edit`} tone="gold">
          <Pencil className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
        </IconBtn>
        <IconBtn
          label={isActive ? "Pause listing" : "Activate listing"}
          onClick={onToggleActive}
          tone="green"
        >
          <Power className={`h-[18px] w-[18px] ${isActive ? "" : "opacity-50"}`} strokeWidth={2} aria-hidden />
        </IconBtn>
        <IconBtn label="Delete listing" onClick={onDelete} tone="red">
          <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
        </IconBtn>
      </div>
    </article>
  );
}
