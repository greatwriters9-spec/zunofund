import type { OfferCardRow } from "@/components/p2p/OfferCard";

/** Reputation fields attached to marketplace offer rows. */
export type MerchantReputationFields = {
  merchant_country: string | null;
  merchant_badge_slug: string | null;
  merchant_rating: number | null;
  merchant_positive_feedback_percent: number | null;
  merchant_total_trades: number | null;
  merchant_completion_rate: number | null;
};

export type MerchantPublicProfile = {
  user_id: string;
  display_name: string | null;
  country: string | null;
  badge_slug: string | null;
  about_merchant: string | null;
  member_since: string | null;
  total_trades: number;
  positive_feedback: number;
  negative_feedback: number;
  neutral_feedback: number;
  positive_feedback_percent: number;
  rating: number;
  completion_rate: number;
  total_volume_traded: number;
  avg_release_time_minutes: number | null;
  avg_payment_time_minutes: number | null;
  avatar_url: string | null;
  is_online: boolean | null;
  last_seen_at: string | null;
  presence_mode: string | null;
};

export type MerchantReviewRow = {
  id: string;
  sentiment: "positive" | "neutral" | "negative";
  comment: string | null;
  created_at: string;
  reviewer_name: string | null;
};

export type MerchantReviewSentiment = MerchantReviewRow["sentiment"];

export function extendOfferRow<T extends OfferCardRow>(row: T, rep?: Partial<MerchantReputationFields> | null): T & MerchantReputationFields {
  return {
    ...row,
    merchant_country: rep?.merchant_country ?? (row as T & MerchantReputationFields).merchant_country ?? null,
    merchant_badge_slug: rep?.merchant_badge_slug ?? (row as T & MerchantReputationFields).merchant_badge_slug ?? null,
    merchant_rating: rep?.merchant_rating ?? (row as T & MerchantReputationFields).merchant_rating ?? null,
    merchant_positive_feedback_percent:
      rep?.merchant_positive_feedback_percent ??
      (row as T & MerchantReputationFields).merchant_positive_feedback_percent ??
      null,
    merchant_total_trades: rep?.merchant_total_trades ?? (row as T & MerchantReputationFields).merchant_total_trades ?? null,
    merchant_completion_rate:
      rep?.merchant_completion_rate ?? (row as T & MerchantReputationFields).merchant_completion_rate ?? null,
  };
}

export function formatMinutesLabel(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
