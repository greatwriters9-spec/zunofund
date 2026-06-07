"use client";

import { useEffect, useRef } from "react";
import { Info } from "lucide-react";

const REMINDERS = [
  "Stay inside escrow — do not send funds outside the platform.",
  "Keep all communication and proof of payment in this thread.",
  "Release crypto only after you have confirmed cleared funds.",
  "Off-platform switches are risky and may not be recoverable.",
] as const;

type TradeSafetyPopoverProps = {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
};

export function TradeSafetyPopover({ open, onToggle, onClose }: TradeSafetyPopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onClose]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-semibold text-[#D4AF37] transition hover:border-[#D4AF37]/30 hover:bg-[#D4AF37]/[0.06] hover:text-[#F5E6B3]"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Trading safely</span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Trading safely"
          className="absolute right-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-white/[0.08] bg-[rgba(12,17,28,0.98)] p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-md"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#F5E6B3]">
            Trading safely
          </p>
          <ul className="mt-2.5 space-y-2 text-[12px] leading-relaxed text-zinc-300">
            {REMINDERS.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#D4AF37]" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
