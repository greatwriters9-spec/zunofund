/** Admin-assigned merchant badges (not automatic). */
export const MERCHANT_BADGE_SLUGS = [
  "verified_merchant",
  "elite_merchant",
  "top_trader",
  "trusted_seller",
  "fast_responder",
  "high_volume_merchant",
  "vip_merchant",
  "gold_merchant",
  "platinum_merchant",
] as const;

export type MerchantBadgeSlug = (typeof MERCHANT_BADGE_SLUGS)[number];

export const MERCHANT_BADGE_LABELS: Record<MerchantBadgeSlug, string> = {
  verified_merchant: "Verified Merchant",
  elite_merchant: "Elite Merchant",
  top_trader: "Top Trader",
  trusted_seller: "Trusted Seller",
  fast_responder: "Fast Responder",
  high_volume_merchant: "High Volume Merchant",
  vip_merchant: "VIP Merchant",
  gold_merchant: "Gold Merchant",
  platinum_merchant: "Platinum Merchant",
};

export const MERCHANT_BADGE_ICONS: Record<MerchantBadgeSlug, string> = {
  verified_merchant: "✓",
  elite_merchant: "🏆",
  top_trader: "📈",
  trusted_seller: "🤝",
  fast_responder: "⚡",
  high_volume_merchant: "📊",
  vip_merchant: "💎",
  gold_merchant: "🥇",
  platinum_merchant: "⭐",
};

export const MERCHANT_BADGE_SHORT_LABELS: Record<MerchantBadgeSlug, string> = {
  verified_merchant: "Verified",
  elite_merchant: "Elite",
  top_trader: "Top",
  trusted_seller: "Trusted",
  fast_responder: "Fast",
  high_volume_merchant: "Volume",
  vip_merchant: "VIP",
  gold_merchant: "Gold",
  platinum_merchant: "Platinum",
};

export function merchantBadgeShortLabel(slug: string | null | undefined): string | null {
  if (!slug?.trim()) return null;
  const key = slug.trim().toLowerCase() as MerchantBadgeSlug;
  return MERCHANT_BADGE_SHORT_LABELS[key] ?? merchantBadgeLabel(slug);
}

export function merchantBadgeIcon(slug: string | null | undefined): string | null {
  if (!slug?.trim()) return null;
  const key = slug.trim().toLowerCase() as MerchantBadgeSlug;
  return MERCHANT_BADGE_ICONS[key] ?? null;
}

export function merchantBadgeLabel(slug: string | null | undefined): string | null {
  if (!slug?.trim()) return null;
  const key = slug.trim().toLowerCase() as MerchantBadgeSlug;
  return MERCHANT_BADGE_LABELS[key] ?? null;
}

export function ratingStars(rating: number): string {
  const r = Math.max(0, Math.min(5, Number.isFinite(rating) ? rating : 0));
  const full = Math.floor(r);
  const half = r - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(empty);
}

/** Compact ★/☆ display for marketplace listings. */
export function ratingStarsCompact(rating: number): string {
  const r = Math.max(0, Math.min(5, Number.isFinite(rating) ? rating : 0));
  const full = Math.min(5, Math.max(0, Math.round(r)));
  return "★".repeat(full) + "☆".repeat(5 - full);
}
