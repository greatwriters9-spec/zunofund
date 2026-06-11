import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchPublishedAnnouncements } from "@/lib/platformConfig/fetch";
import {
  formatAnnouncementMonthYear,
  pickFeaturedAnnouncement,
} from "@/lib/platformConfig/helpers";
import type { AnnouncementRow } from "@/lib/platformConfig/types";

export type { AnnouncementCategory } from "@/lib/platformConfig/types";
export { ANNOUNCEMENT_CATEGORIES } from "@/lib/platformConfig/types";
export { formatAnnouncementMonthYear, pickFeaturedAnnouncement };

/** @deprecated Use AnnouncementRow from lib/platformConfig */
export type Announcement = AnnouncementRow;

export async function fetchAnnouncements(
  supabase: SupabaseClient,
): Promise<AnnouncementRow[]> {
  return fetchPublishedAnnouncements(supabase);
}

export async function fetchFeaturedAnnouncement(
  supabase: SupabaseClient,
): Promise<AnnouncementRow | null> {
  const items = await fetchAnnouncements(supabase);
  return pickFeaturedAnnouncement(items);
}
