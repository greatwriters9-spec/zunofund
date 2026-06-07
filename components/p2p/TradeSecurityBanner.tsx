"use client";

import { Shield } from "lucide-react";

export function TradeSecurityBanner() {
  return (
    <div className="shrink-0 px-2.5 py-1.5 sm:px-4 sm:py-2">
      <div className="flex items-center gap-2 rounded-full border border-[#00C076]/30 bg-[#00C076]/[0.09] px-3 py-1.5 sm:px-4 sm:py-2">
        <Shield className="h-3.5 w-3.5 shrink-0 text-[#00C076]" aria-hidden />
        <p className="min-w-0 text-[11px] leading-snug text-[#B8F5D8] break-words sm:text-[12.5px]">
          Keep all communication and proof of payment inside Zuno. Off-platform communication may
          not be protected by escrow.
        </p>
      </div>
    </div>
  );
}
