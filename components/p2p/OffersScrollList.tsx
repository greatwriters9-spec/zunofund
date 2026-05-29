"use client";

import { useRef, type ReactNode } from "react";

type OffersScrollListProps = {
  children: ReactNode;
  className?: string;
  /** When true, allow horizontal scroll for wide table-style strips (merchant console). */
  stripLayout?: boolean;
};

/** Scrollable offers list — refresh only via the toolbar Refresh control. */
export function OffersScrollList({ children, className = "", stripLayout = false }: OffersScrollListProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`relative w-full min-w-0 ${className}`}>
      <div
        ref={scrollerRef}
        className={`relative z-0 max-h-[min(68dvh,calc(100dvh-16rem))] touch-pan-y rounded-2xl border border-white/[0.08] bg-[#070b12]/92 pr-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] pb-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 ${
          stripLayout ? "overflow-x-auto overflow-y-auto" : "overflow-x-hidden overflow-y-auto"
        }`}
      >
        {stripLayout ? <div className="w-full min-w-[44rem]">{children}</div> : children}
      </div>
    </div>
  );
}
