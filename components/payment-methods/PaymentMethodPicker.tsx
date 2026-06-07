"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";

import { PaymentMethodsDropdown } from "@/components/payment-methods/PaymentMethodsDropdown";
import { PaymentMethodsSheet } from "@/components/payment-methods/PaymentMethodsSheet";
import { findPaymentMethodLabel } from "@/components/payment-methods/paymentMethodsCatalog";

type PaymentMethodPickerProps = {
  value: string;
  onChange: (code: string) => void;
  allowAllMethods?: boolean;
  /** Toolbar-style trigger (default) or compact field label for forms. */
  variant?: "toolbar" | "field" | "landing";
  fieldLabel?: string;
  /** Muted fill for “I have” style fields on landing. */
  tone?: "default" | "muted";
  className?: string;
  onOpenChange?: (open: boolean) => void;
  /** e.g. `lg:hidden` when the sheet is mobile-only. */
  sheetOverlayClassName?: string;
};

export function PaymentMethodPicker({
  value,
  onChange,
  allowAllMethods = true,
  variant = "toolbar",
  fieldLabel = "I Have",
  tone = "default",
  className = "",
  onOpenChange,
  sheetOverlayClassName = "",
}: PaymentMethodPickerProps) {
  const [open, setOpen] = useState(false);
  const useToolbarDropdown = variant === "toolbar";

  const displayLabel =
    !value.trim() && !allowAllMethods
      ? "Payment method"
      : findPaymentMethodLabel(value);
  const isPlaceholder = !allowAllMethods && !value.trim();

  function setSheetOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  const trigger =
    variant === "toolbar" ? (
      <button
        type="button"
        className={`flex h-[42px] w-full items-center justify-between gap-2 rounded-xl border border-white/[0.1] bg-black/35 px-3 py-2 text-left text-[12px] font-medium text-zinc-200 hover:border-[#D4AF37]/35 ${className}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setSheetOpen(!open)}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-75" aria-hidden />
      </button>
    ) : variant === "landing" ? (
      <button
        type="button"
        className={`flex w-full flex-col rounded-2xl border border-white/[0.08] px-4 py-3.5 text-left transition hover:border-[#D4AF37]/35 focus:border-[#D4AF37]/45 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/25 ${
          tone === "muted" ? "bg-zinc-900/70" : "bg-white/[0.04]"
        } ${className}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setSheetOpen(true)}
      >
        <span className="mb-1.5 text-xs font-medium text-zinc-500">{fieldLabel}</span>
        <span className="flex items-center gap-3">
          <span className={`flex-1 text-base font-semibold ${isPlaceholder ? "text-zinc-500" : "text-white"}`}>
            {displayLabel}
          </span>
          <Pencil className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        </span>
      </button>
    ) : (
      <div className={className}>
        <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          {fieldLabel}
        </span>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-700/90 bg-zinc-950/80 px-4 py-3.5 text-left text-sm font-medium transition hover:border-[#D4AF37]/40 focus:border-[#D4AF37]/50 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/30"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setSheetOpen(true)}
        >
          <span className={isPlaceholder ? "text-zinc-500" : "text-white"}>{displayLabel}</span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-700/80 text-zinc-500">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </span>
        </button>
      </div>
    );

  const sheet =
    typeof document !== "undefined"
      ? createPortal(
          <PaymentMethodsSheet
            open={open && !useToolbarDropdown}
            selectedCode={value}
            allowAllMethods={allowAllMethods}
            onClose={() => setSheetOpen(false)}
            onApply={(code) => onChange(code)}
            overlayClassName={sheetOverlayClassName}
            zIndexClass="z-[300]"
          />,
          document.body,
        )
      : null;

  return (
    <div className={`relative ${open && useToolbarDropdown ? "z-[110]" : ""}`}>
      {trigger}
      {useToolbarDropdown ? (
        <PaymentMethodsDropdown
          open={open}
          selectedCode={value}
          allowAllMethods={allowAllMethods}
          onClose={() => setSheetOpen(false)}
          onSelect={onChange}
        />
      ) : (
        sheet
      )}
    </div>
  );
}
