import type { SupabaseClient } from "@supabase/supabase-js";

import { FALLBACK_PLATFORM_CONFIG } from "@/lib/platformConfig/fallbacks";
import type {
  AnnouncementRow,
  InvestmentPlanRow,
  PlatformConfig,
  PromotionSettingsRow,
} from "@/lib/platformConfig/types";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapPlan(row: Record<string, unknown>): InvestmentPlanRow {
  return {
    id: String(row.id),
    name: String(row.name),
    min_deposit: num(row.min_deposit),
    max_deposit: num(row.max_deposit),
    daily_roi: num(row.daily_roi),
    promotion_return_target: num(row.promotion_return_target),
    promotion_active: Boolean(row.promotion_active),
    sort_order: Number(row.sort_order) || 0,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapPromotion(row: Record<string, unknown>): PromotionSettingsRow {
  return {
    id: String(row.id),
    promotion_title: String(row.promotion_title),
    promotion_description:
      row.promotion_description == null ? null : String(row.promotion_description),
    promotion_end_date: String(row.promotion_end_date),
    partner_fund_amount:
      row.partner_fund_amount == null ? null : num(row.partner_fund_amount),
    show_countdown: Boolean(row.show_countdown),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapAnnouncement(row: Record<string, unknown>): AnnouncementRow {
  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    category: String(row.category),
    featured: Boolean(row.featured),
    published: Boolean(row.published),
    created_at: String(row.created_at),
  };
}

export async function fetchPlatformConfig(
  supabase: SupabaseClient,
  options?: { includeUnpublishedAnnouncements?: boolean },
): Promise<PlatformConfig> {
  const includeUnpublished = options?.includeUnpublishedAnnouncements ?? false;

  const [plansRes, promotionRes, announcementsRes] = await Promise.all([
    supabase.from("investment_plans").select("*").order("sort_order", { ascending: true }),
    supabase.from("promotion_settings").select("*").limit(1).maybeSingle(),
    includeUnpublished
      ? supabase.from("announcements").select("*").order("created_at", { ascending: false })
      : supabase
          .from("announcements")
          .select("*")
          .eq("published", true)
          .order("created_at", { ascending: false }),
  ]);

  const plans =
    plansRes.data && plansRes.data.length > 0
      ? plansRes.data.map((r) => mapPlan(r as Record<string, unknown>))
      : FALLBACK_PLATFORM_CONFIG.plans;

  const promotion = promotionRes.data
    ? mapPromotion(promotionRes.data as Record<string, unknown>)
    : FALLBACK_PLATFORM_CONFIG.promotion;

  const announcements =
    announcementsRes.data && announcementsRes.data.length > 0
      ? announcementsRes.data.map((r) => mapAnnouncement(r as Record<string, unknown>))
      : FALLBACK_PLATFORM_CONFIG.announcements;

  return { plans, promotion, announcements };
}

export async function fetchPublishedAnnouncements(
  supabase: SupabaseClient,
): Promise<AnnouncementRow[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error || !data?.length) {
    return FALLBACK_PLATFORM_CONFIG.announcements;
  }

  return data.map((r) => mapAnnouncement(r as Record<string, unknown>));
}
