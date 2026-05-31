"use client";

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
    "shrink-0 touch-manipulation rounded-xl border px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] transition sm:px-5 sm:py-3 sm:text-[11px]";
  return active
    ? `${base} border-[#D4AF37]/55 bg-black/55 text-[#F5E6B3] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-[#D4AF37]/25`
    : `${base} border-white/12 bg-black/28 text-zinc-500 hover:border-[#D4AF37]/30 hover:text-zinc-300`;
}

/** Sticky horizontal console nav — items flow right-to-left across the main column. */
export function MerchantConsoleStickyNav({
  section,
  onSectionChange,
  counts,
}: MerchantConsoleStickyNavProps) {
  return (
    <nav
      aria-label="Merchant console sections"
      className="sticky top-0 z-30 -mx-4 mb-6 border-b border-[#D4AF37]/15 bg-[#03060c]/95 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-[#03060c]/88 sm:-mx-6 sm:px-6 lg:top-0"
    >
      <div
        className="flex flex-row-reverse items-stretch justify-end gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {ITEMS.map(({ id, label }) => {
          const active = section === id;
          const count = counts?.[id];
          const showCount = count != null && id !== "visibility";
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSectionChange(id)}
              className={pillClass(active)}
            >
              {label}
              {showCount ? (
                <span className={`ml-1.5 tabular-nums ${active ? "text-[#D4AF37]/80" : "text-zinc-600"}`}>
                  ({count})
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
