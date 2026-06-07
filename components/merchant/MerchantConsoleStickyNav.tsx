"use client";

import { MERCHANT_BG } from "@/components/merchant/merchantStyles";

export type MerchantConsoleSection = "visibility" | "offers" | "active" | "completed";

const ITEMS: { id: MerchantConsoleSection; label: string }[] = [
  { id: "visibility", label: "Your visibility" },
  { id: "offers", label: "Active offers" },
  { id: "active", label: "Active trades" },
  { id: "completed", label: "Completed trades" },
];

type MerchantConsoleStickyNavProps = {
  section: MerchantConsoleSection;
  onSectionChange: (section: MerchantConsoleSection) => void;
  counts?: Partial<Record<MerchantConsoleSection, number | null>>;
};

function pillClass(active: boolean): string {
  const base =
    "shrink-0 touch-manipulation whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-[11px] font-semibold transition sm:px-4 sm:text-xs";
  return active
    ? `${base} border-[#D4AF37]/40 bg-[#D4AF37]/[0.08] text-[#F5E6B3] shadow-[0_0_20px_-6px_rgba(212,175,55,0.35)] ring-1 ring-[#D4AF37]/20`
    : `${base} border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:border-[#D4AF37]/25 hover:bg-white/[0.04] hover:text-zinc-200`;
}

function tabLabel(label: string, count: number | null | undefined, showCount: boolean): string {
  if (!showCount || count == null) return label;
  return `${label}(${count})`;
}

/** Sticky console nav — primary page chrome for the merchant dashboard. */
export function MerchantConsoleStickyNav({
  section,
  onSectionChange,
  counts,
}: MerchantConsoleStickyNavProps) {
  return (
    <nav
      aria-label="Merchant console sections"
      className="sticky top-0 z-30 -mx-4 mb-5 border-b border-white/[0.06] px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6"
      style={{ backgroundColor: `${MERCHANT_BG}f2` }}
    >
      <div
        className="flex items-stretch gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {ITEMS.map(({ id, label }) => {
          const active = section === id;
          const count = counts?.[id];
          const showCount = id !== "visibility";
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSectionChange(id)}
              className={pillClass(active)}
            >
              {tabLabel(label, count, showCount)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
