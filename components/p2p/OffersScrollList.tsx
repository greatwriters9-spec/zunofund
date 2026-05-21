"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

type OffersScrollListProps = {
  children: ReactNode;
  onRefresh: () => void | Promise<void>;
  loading?: boolean;
  className?: string;
};

const PULL_THRESHOLD = 56;
const BOTTOM_THRESHOLD = 48;
const REFRESH_COOLDOWN_MS = 1200;

export function OffersScrollList({ children, onRefresh, loading, className = "" }: OffersScrollListProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const refreshingRef = useRef(false);
  const lastRefreshAt = useRef(0);
  const [pullOffset, setPullOffset] = useState(0);
  const pullOffsetRef = useRef(0);
  const [refreshing, setRefreshing] = useState(false);

  const runRefresh = useCallback(async () => {
    const now = Date.now();
    if (refreshingRef.current || now - lastRefreshAt.current < REFRESH_COOLDOWN_MS) return;
    refreshingRef.current = true;
    setRefreshing(true);
    lastRefreshAt.current = now;
    try {
      await onRefresh();
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
      setPullOffset(0);
    }
  }, [onRefresh]);

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || loading) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD;
    if (nearBottom) void runRefresh();
  }, [loading, runRefresh]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={scrollerRef}
        className="relative z-0 max-h-[min(68dvh,calc(100dvh-16rem))] touch-pan-y overflow-y-auto overflow-x-hidden rounded-2xl border border-white/[0.08] bg-[#070b12]/92 pr-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] pb-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2"
        onScroll={handleScroll}
        onTouchStart={(e) => {
          touchStartY.current = e.touches[0]?.clientY ?? 0;
        }}
        onTouchMove={(e) => {
          const el = scrollerRef.current;
          if (!el || el.scrollTop > 0) {
            setPullOffset(0);
            return;
          }
          const y = e.touches[0]?.clientY ?? 0;
          const delta = y - touchStartY.current;
          if (delta > 0) {
            const next = Math.min(delta * 0.45, 72);
            pullOffsetRef.current = next;
            setPullOffset(next);
          }
        }}
        onTouchEnd={() => {
          if (pullOffsetRef.current >= PULL_THRESHOLD) void runRefresh();
          pullOffsetRef.current = 0;
          setPullOffset(0);
        }}
      >
        <div
          className="flex items-center justify-center text-[11px] font-medium text-zinc-500 transition-[height] duration-150"
          style={{ height: pullOffset > 0 || refreshing ? Math.max(pullOffset, refreshing ? 28 : 0) : 0 }}
          aria-live="polite"
        >
          {refreshing || loading ? "Refreshing offers…" : pullOffset > 20 ? "Release to refresh" : "Pull down to refresh"}
        </div>
        {children}
        <div className="py-3 text-center text-[10px] text-zinc-600">
          {refreshing ? "Updating…" : "Scroll for more · refreshes at the end"}
        </div>
      </div>
    </div>
  );
}
