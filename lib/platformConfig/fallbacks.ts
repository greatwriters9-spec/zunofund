import type {
  AnnouncementRow,
  InvestmentPlanRow,
  PlatformConfig,
  PromotionSettingsRow,
} from "@/lib/platformConfig/types";

export const FALLBACK_PROMOTION: PromotionSettingsRow = {
  id: "fallback",
  promotion_title: "Partner Promotion Active",
  promotion_description: null,
  promotion_end_date: "2027-01-01T00:00:00.000Z",
  partner_fund_amount: null,
  show_countdown: true,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

export const FALLBACK_PLANS: InvestmentPlanRow[] = [
  {
    id: "fallback-starter",
    name: "Starter",
    min_deposit: 20,
    max_deposit: 499.99,
    daily_roi: 10,
    promotion_return_target: 500,
    promotion_active: true,
    sort_order: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "fallback-growth",
    name: "Growth",
    min_deposit: 500,
    max_deposit: 1499.99,
    daily_roi: 20,
    promotion_return_target: 1500,
    promotion_active: true,
    sort_order: 2,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "fallback-pro",
    name: "Pro",
    min_deposit: 1500,
    max_deposit: 4999.99,
    daily_roi: 30,
    promotion_return_target: 3000,
    promotion_active: true,
    sort_order: 3,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "fallback-elite",
    name: "Elite",
    min_deposit: 5000,
    max_deposit: 999999999,
    daily_roi: 50,
    promotion_return_target: 10000,
    promotion_active: true,
    sort_order: 4,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

export const FALLBACK_ANNOUNCEMENTS: AnnouncementRow[] = [
  {
    id: "fallback-featured",
    title: "Trading Volume Growth Update",
    content:
      "Our partner network has expanded and platform trading volume continues to grow. Promotional incentives remain active while additional opportunities are being evaluated.",
    category: "Promotion Updates",
    featured: true,
    published: true,
    created_at: "2026-06-01T00:00:00.000Z",
  },
];

export const FALLBACK_PLATFORM_CONFIG: PlatformConfig = {
  plans: FALLBACK_PLANS,
  promotion: FALLBACK_PROMOTION,
  announcements: FALLBACK_ANNOUNCEMENTS,
};
