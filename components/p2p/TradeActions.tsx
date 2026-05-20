"use client";

import type { ReactNode } from "react";

type TradeActionsProps = {
  children: ReactNode;
  /** Extra content above the sticky bar (e.g. proof input) */
  auxiliary?: ReactNode;
  /** Inside trade shell — full-width footer, no viewport sticky */
  variant?: "sticky" | "embedded";
};

export function TradeActions({ children, auxiliary, variant = "sticky" }: TradeActionsProps) {
  if (variant === "embedded") {
    return (
      <div className="shrink-0 border-t border-white/[0.06] bg-black/[0.08] backdrop-blur-md">
        {auxiliary ? <div className="border-b border-white/[0.06] px-4 pb-3 pt-3 sm:px-5">{auxiliary}</div> : null}
        <div className="flex flex-col gap-2 px-4 py-3 sm:gap-3 sm:px-5">{children}</div>
      </div>
    );
  }

  return (
    <div className="pb-[env(safe-area-inset-bottom)]">
      {auxiliary ? <div className="mx-4 mb-3 sm:mx-5">{auxiliary}</div> : null}
      <div className="sticky bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-[#05080F]/80 px-4 py-4 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md sm:px-5">
        <div className="mx-auto flex max-w-lg flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}
