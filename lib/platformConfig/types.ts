export interface InvestmentPlanRow {
  id: string;
  name: string;
  min_deposit: number;
  max_deposit: number;
  daily_roi: number;
  promotion_return_target: number;
  promotion_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PromotionSettingsRow {
  id: string;
  promotion_title: string;
  promotion_description: string | null;
  promotion_end_date: string;
  partner_fund_amount: number | null;
  show_countdown: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  category: string;
  featured: boolean;
  published: boolean;
  created_at: string;
}

export interface PlatformConfig {
  plans: InvestmentPlanRow[];
  promotion: PromotionSettingsRow | null;
  announcements: AnnouncementRow[];
}

export const ANNOUNCEMENT_CATEGORIES = [
  "Promotion Updates",
  "Trading Performance",
  "Platform News",
  "Community Growth",
  "Important Notices",
] as const;

export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];
