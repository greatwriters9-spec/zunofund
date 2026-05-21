"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  FIAT_CURRENCIES,
  type FiatCurrencyCode,
  getFiatCurrency,
} from "@/lib/currencies";

type CurrencyPickerProps = {
  value: FiatCurrencyCode;
  onChange: (next: FiatCurrencyCode) => void;
  /** Visual size — `sm` is suitable for toolbar chips, `md` for cards. */
  size?: "sm" | "md";
  /** Optional small uppercase label rendered above the trigger ("Display in"). */
  label?: string;
  className?: string;
  /** Lock the trigger label to short form (`KES`) vs `🇰🇪 KES`. Defaults to flag+code. */
  triggerVariant?: "code-only" | "flag-code";
  /** Anchor the popover to the right edge of the trigger (useful in headers). */
  align?: "start" | "end";
};

/**
 * Reusable fiat picker — opens a scrollable list of supported currencies.
 * Keyboard-accessible, dismisses on outside click, and stays inside the
 * viewport on mobile by clamping its width.
 */
export function CurrencyPicker({
  value,
  onChange,
  size = "md",
  label,
  className = "",
  triggerVariant = "flag-code",
  align = "start",
}: CurrencyPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cur = getFiatCurrency(value);
  const triggerSize =
    size === "sm"
      ? "h-8 px-2 text-[11px]"
      : "h-10 px-3 text-[12px]";
  const alignClass = align === "end" ? "right-0 left-auto" : "left-0 right-auto";

  return (
    <div ref={rootRef} className={`relative inline-flex flex-col ${className}`}>
      {label ? (
        <span className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
          {label}
        </span>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        aria-label="Choose display currency"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-between gap-1.5 rounded-xl border border-white/[0.1] bg-black/35 font-semibold uppercase tracking-wide text-[#F5E6B3] ring-1 ring-white/[0.04] transition hover:border-[#D4AF37]/35 ${triggerSize}`}
      >
        <span className="truncate">
          {triggerVariant === "code-only" ? cur.code : `${cur.flag} ${cur.code}`}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-75" aria-hidden />
      </button>

      {open ? (
        <div
          role="listbox"
          className={`absolute top-[calc(100%+6px)] z-[140] max-h-[min(320px,50dvh)] w-[min(15rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-white/[0.1] bg-[#0c1018] py-1.5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.85)] backdrop-blur-md [&::-webkit-scrollbar]:w-1.5 ${alignClass}`}
        >
          {FIAT_CURRENCIES.map((c) => (
            <button
              key={c.code}
              type="button"
              role="option"
              aria-selected={value === c.code}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition hover:bg-white/[0.05] ${
                value === c.code ? "bg-[#D4AF37]/10 text-[#F5E6B3]" : "text-zinc-300"
              }`}
              onClick={() => {
                onChange(c.code);
                setOpen(false);
              }}
            >
              <span aria-hidden>{c.flag}</span>
              <span className="font-bold">{c.code}</span>
              <span className="truncate text-[11px] text-zinc-500">{c.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
