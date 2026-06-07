"use client";

import { useRef, type ReactNode } from "react";

type OffersScrollListProps = {
  children: ReactNode;
  className?: string;
  /** When true, allow horizontal scroll for wide table-style strips (merchant console). */
  stripLayout?: boolean;
  /** Marketplace: rows flow with the page — no inset card or inner scroll pane. */
  fullPage?: boolean;
};

/** Offers list — boxed scroll for merchant console; full-page flow for marketplace. */
export function OffersScrollList({
  children,
  className = "",
  stripLayout = false,
  fullPage = false,
}: OffersScrollListProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  if (fullPage) {
    return <div className={`relative w-full min-w-0 ${className}`}>{children}</div>;
  }

  return (
    <div className={`relative w-full min-w-0 ${className}`}>
      <div
        ref={scrollerRef}
        className={`relative z-0 w-full min-w-0 ${
          stripLayout
            ? "max-lg:overflow-visible max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none max-lg:pr-0 max-lg:pb-0 lg:max-h-[min(68dvh,calc(100dvh-16rem))] lg:overflow-x-auto lg:overflow-y-auto lg:rounded-2xl lg:border lg:border-white/[0.06] lg:bg-[rgba(12,17,28,0.85)] lg:pr-1 lg:shadow-[0_8px_32px_rgba(0,0,0,0.35)] lg:backdrop-blur-md lg:pb-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2"
            : "max-h-[min(68dvh,calc(100dvh-16rem))] touch-pan-y overflow-x-hidden overflow-y-auto rounded-2xl border border-white/[0.06] bg-[rgba(12,17,28,0.85)] pr-1 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md pb-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2"
        }`}
      >
        {stripLayout ? (
          <div className="w-full min-w-0 space-y-3 max-lg:space-y-3 lg:min-w-[44rem] lg:space-y-0">{children}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
