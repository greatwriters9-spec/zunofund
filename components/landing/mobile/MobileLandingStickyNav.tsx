"use client";

import { useCallback, useEffect, useState } from "react";

import {
  MOBILE_LANDING_TABS,
  type MobileLandingTabId,
} from "@/components/landing/mobile/mobileLandingData";

const SCROLL_OFFSET = 120;

function scrollToSection(targetId: string) {
  const el = document.getElementById(targetId);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
  window.scrollTo({ top, behavior: "smooth" });
}

type MobileLandingStickyNavProps = {
  activeTab: MobileLandingTabId;
  onTabChange: (tab: MobileLandingTabId) => void;
  variant?: "default" | "floating" | "segment";
};

export function MobileLandingStickyNav({
  activeTab,
  onTabChange,
  variant = "default",
}: MobileLandingStickyNavProps) {
  const isSegment = variant === "segment";
  const isFloating = variant === "floating";

  if (isSegment) {
    return (
      <div
        className="mx-auto mb-4 flex max-w-md gap-1 rounded-2xl bg-black/30 p-1 ring-1 ring-white/[0.06]"
        role="tablist"
        aria-label="Landing sections"
      >
        {MOBILE_LANDING_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                onTabChange(tab.id);
                scrollToSection(tab.targetId);
              }}
              className={`flex-1 rounded-xl py-2.5 text-center text-sm font-bold transition ${
                isActive
                  ? "bg-[#D4AF37] text-black shadow-[0_4px_14px_-4px_rgba(212,175,55,0.55)]"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={
        isFloating
          ? "sticky z-[190] mx-0 mb-2 rounded-2xl border border-white/[0.1] bg-[#0a0e16]/92 p-1.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55),0_0_24px_-8px_rgba(212,175,55,0.12)] backdrop-blur-xl"
          : "sticky z-[190] border-b border-white/10 bg-[#05080F]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[#05080F]/88"
      }
      style={isFloating ? { top: "calc(env(safe-area-inset-top) + 3.5rem)" } : { top: "calc(env(safe-area-inset-top) + 3.5rem)" }}
    >
      <div
        className={`flex gap-1 ${isFloating ? "" : "mx-auto max-w-lg px-3 py-2"}`}
        role="tablist"
        aria-label="Landing sections"
      >
        {MOBILE_LANDING_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                onTabChange(tab.id);
                scrollToSection(tab.targetId);
              }}
              className={`flex-1 rounded-xl py-2.5 text-center text-sm font-semibold transition ${
                isActive
                  ? "bg-[#D4AF37]/18 text-[#F5E6B3] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-[#D4AF37]/35"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function useMobileLandingActiveTab(): [
  MobileLandingTabId,
  (tab: MobileLandingTabId) => void,
] {
  const [activeTab, setActiveTab] = useState<MobileLandingTabId>("p2p");

  const updateFromScroll = useCallback(() => {
    const offsets = MOBILE_LANDING_TABS.map((tab) => {
      const el = document.getElementById(tab.targetId);
      if (!el) return { id: tab.id, top: Infinity };
      const rect = el.getBoundingClientRect();
      return { id: tab.id, top: rect.top };
    });

    const visible = offsets.filter((o) => o.top <= SCROLL_OFFSET + 40);
    if (visible.length === 0) {
      setActiveTab("p2p");
      return;
    }

    const current = visible.reduce((best, item) => (item.top > best.top ? item : best));
    setActiveTab(current.id);
  }, []);

  useEffect(() => {
    updateFromScroll();
    window.addEventListener("scroll", updateFromScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateFromScroll);
  }, [updateFromScroll]);

  return [activeTab, setActiveTab];
}
