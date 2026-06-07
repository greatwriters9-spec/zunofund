"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";

import { CryptocurrencyDropdown } from "@/components/market-pickers/CryptocurrencyDropdown";
import { CryptocurrencySheet } from "@/components/market-pickers/CryptocurrencySheet";
import { CryptoIcon } from "@/components/market-pickers/CryptoIcon";
import {
  CRYPTO_ASSET_CATALOG,
  findCryptoLabel,
  type CryptoAssetItem,
} from "@/components/market-pickers/cryptoCatalog";

type CryptoPickerProps = {
  value: string;
  onChange: (code: string) => void;
  context: "landing" | "portal";
  allowAllCrypto?: boolean;
  variant?: "toolbar" | "field" | "landing";
  fieldLabel?: string;
  className?: string;
  onOpenChange?: (open: boolean) => void;
  sheetOverlayClassName?: string;
  assetList?: CryptoAssetItem[];
  forceSelectable?: boolean;
  /** Override trigger label (e.g. USDT · Tether in toolbar). */
  displayLabel?: string;
};

export function CryptoPicker({
  value,
  onChange,
  context,
  allowAllCrypto = false,
  variant = "toolbar",
  fieldLabel = "I Want",
  className = "",
  onOpenChange,
  sheetOverlayClassName = "",
  assetList,
  forceSelectable = false,
  displayLabel,
}: CryptoPickerProps) {
  const [open, setOpen] = useState(false);
  const useToolbarDropdown = variant === "toolbar";

  const label =
    displayLabel ??
    (!value.trim() ? "Cryptocurrency" : findCryptoLabel(value, context));
  const isPlaceholder = !value.trim();
  const catalog = assetList ?? CRYPTO_ASSET_CATALOG;
  const selectedAsset =
    catalog.find((a) => a.code === value) ?? catalog.find((a) => a.code === "ALL");

  function setSheetOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  const trigger =
    variant === "toolbar" ? (
      <button
        type="button"
        className={`flex min-h-[38px] min-w-[6.25rem] items-center justify-between gap-1 rounded-xl border border-white/[0.1] bg-black/35 px-2 py-1.5 text-left text-[11px] font-semibold text-[#F5E6B3] ring-1 ring-white/[0.04] hover:border-[#D4AF37]/35 sm:min-h-[42px] sm:min-w-[10.5rem] sm:gap-2 sm:px-3 sm:py-2 sm:text-[12px] ${className}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setSheetOpen(!open)}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-75" aria-hidden />
      </button>
    ) : variant === "landing" ? (
      <button
        type="button"
        className={`flex w-full flex-col rounded-2xl border border-white/[0.12] bg-white/[0.04] px-4 py-3.5 text-left transition hover:border-[#D4AF37]/35 focus:border-[#D4AF37]/45 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/25 ${className}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setSheetOpen(true)}
      >
        <span className="mb-1.5 text-xs font-medium text-zinc-500">{fieldLabel}</span>
        <span className="flex items-center gap-3">
          {selectedAsset ? <CryptoIcon asset={selectedAsset} /> : null}
          <span className={`flex-1 text-base font-semibold ${isPlaceholder ? "text-zinc-500" : "text-white"}`}>
            {label}
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
          <span className={isPlaceholder ? "text-zinc-500" : "text-white"}>{label}</span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-700/80 text-zinc-500">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </span>
        </button>
      </div>
    );

  const sheet =
    typeof document !== "undefined"
      ? createPortal(
          <CryptocurrencySheet
            open={open && !useToolbarDropdown}
            selectedCode={value}
            context={context}
            allowAllCrypto={allowAllCrypto}
            onClose={() => setSheetOpen(false)}
            onApply={(code) => onChange(code)}
            overlayClassName={sheetOverlayClassName}
            assetList={assetList}
            forceSelectable={forceSelectable}
            zIndexClass="z-[300]"
          />,
          document.body,
        )
      : null;

  return (
    <div className={`relative ${open && useToolbarDropdown ? "z-[110]" : ""}`}>
      {trigger}
      {useToolbarDropdown ? (
        <CryptocurrencyDropdown
          open={open}
          selectedCode={value}
          context={context}
          allowAllCrypto={allowAllCrypto}
          assetList={assetList}
          forceSelectable={forceSelectable}
          onClose={() => setSheetOpen(false)}
          onSelect={onChange}
        />
      ) : (
        sheet
      )}
    </div>
  );
}
