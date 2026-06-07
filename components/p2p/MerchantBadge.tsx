"use client";

import { merchantBadgeIcon, merchantBadgeLabel, merchantBadgeShortLabel } from "@/lib/merchantBadges";

type MerchantBadgeProps = {
  slug: string | null | undefined;
  size?: "sm" | "md";
  /** `inline` — icon + full label; `marketplace` — compact pill for offer rows; `pill` — bordered chip for profile/admin */
  variant?: "pill" | "inline" | "marketplace";
  className?: string;
};

export function MerchantBadge({
  slug,
  size = "sm",
  variant = "pill",
  className = "",
}: MerchantBadgeProps) {
  const label = merchantBadgeLabel(slug);
  if (!label) return null;

  const icon = merchantBadgeIcon(slug);

  if (variant === "marketplace") {
    const shortLabel = merchantBadgeShortLabel(slug);
    if (!shortLabel) return null;
    return (
      <span
        className={`inline-flex shrink-0 items-center rounded-full border border-[#D4AF37]/40 bg-[rgba(212,175,55,0.08)] px-1.5 py-px text-[9px] font-semibold leading-4 tracking-wide text-[#F5E6B3] md:px-2 md:py-0.5 md:text-[10px] ${className}`}
      >
        {shortLabel}
      </span>
    );
  }

  if (variant === "inline") {
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium leading-none text-[#D4AF37]/95 max-md:text-[9px] ${className}`}
      >
        {icon ? (
          <span aria-hidden className="text-[11px] leading-none max-md:text-[10px]">
            {icon}
          </span>
        ) : null}
        <span className="whitespace-nowrap">{label}</span>
      </span>
    );
  }

  const sizeClass =
    size === "md"
      ? "px-2.5 py-1 text-[11px]"
      : "px-2 py-0.5 text-[9px] max-md:text-[8px]";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-[#D4AF37]/35 bg-[#D4AF37]/12 font-bold uppercase tracking-wide text-[#F5E6B3] ring-1 ring-[#D4AF37]/20 ${sizeClass} ${className}`}
    >
      {icon ? <span aria-hidden>{icon}</span> : null}
      {label}
    </span>
  );
}
