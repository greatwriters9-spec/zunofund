"use client";

import type { P2pAssetCode } from "@/lib/p2pAssets";

const UNITS: readonly P2pAssetCode[] = ["USDT", "BTC"];

type CryptoUnitPickerProps = {
  value: P2pAssetCode;
  onChange: (next: P2pAssetCode) => void;
  size?: "sm" | "md";
  className?: string;
};

export function CryptoUnitPicker({
  value,
  onChange,
  size = "sm",
  className = "",
}: CryptoUnitPickerProps) {
  const h = size === "sm" ? "h-8" : "h-10";
  const text = size === "sm" ? "text-[11px]" : "text-[12px]";

  return (
    <div
      role="group"
      aria-label="Balance unit"
      className={`inline-flex rounded-xl border border-white/[0.1] bg-black/35 p-0.5 ring-1 ring-white/[0.04] ${className}`}
    >
      {UNITS.map((u) => (
        <button
          key={u}
          type="button"
          aria-pressed={value === u}
          onClick={() => onChange(u)}
          className={`${h} min-w-[3.25rem] rounded-[10px] px-2.5 font-bold uppercase tracking-wide transition ${text} ${
            value === u
              ? "bg-[#D4AF37]/20 text-[#F5E6B3] ring-1 ring-[#D4AF37]/40"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
