import type { SupabaseClient } from "@supabase/supabase-js";

import { notificationsOwnerOrFilter } from "@/lib/notificationQuery";

const UNREAD_FALLBACK_PAGE = 800;
const UNREAD_FALLBACK_CAP = UNREAD_FALLBACK_PAGE * 50;

async function countUnreadViaOwnerScan(
  supabase: SupabaseClient,
  ownerFilter: string,
): Promise<number> {
  let total = 0;
  let from = 0;

  while (from < UNREAD_FALLBACK_CAP) {
    const to = from + UNREAD_FALLBACK_PAGE - 1;
    const { data, error } = await supabase
      .from("notifications")
      .select("is_read")
      .or(ownerFilter)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return 0;
    }
    const batch = data ?? [];
    total += batch.filter((row) => row.is_read !== true).length;
    if (batch.length < UNREAD_FALLBACK_PAGE) break;
    from += UNREAD_FALLBACK_PAGE;
  }

  return total;
}

export type InvestorNotificationPreview = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export async function fetchInvestorNotificationSnapshot(
  supabase: SupabaseClient,
  userId: string,
  investorEmail: string,
): Promise<{ preview: InvestorNotificationPreview[]; unreadTotal: number }> {
  const ownerFilter = notificationsOwnerOrFilter({
    userId,
    investorEmail,
  });

  const [{ data: rpcCount, error: rpcErr }, previewRes] = await Promise.all([
    supabase.rpc("investor_unread_notifications_count"),
    supabase
      .from("notifications")
      .select("id, title, message, is_read, created_at")
      .or(ownerFilter)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  let unreadTotal = 0;
  if (!rpcErr && rpcCount != null) {
    if (typeof rpcCount === "bigint") {
      unreadTotal = Number(rpcCount);
    } else if (typeof rpcCount === "number") {
      unreadTotal = rpcCount;
    } else {
      unreadTotal = Number(String(rpcCount));
    }
    if (!Number.isFinite(unreadTotal) || unreadTotal < 0) {
      unreadTotal = 0;
    }
  } else {
    unreadTotal = await countUnreadViaOwnerScan(supabase, ownerFilter);
  }

  const previewRows =
    (previewRes.data as InvestorNotificationPreview[] | null) ?? [];

  /** Dashboard surfaces only unread; no fallback to read messages. */
  const preview = previewRows
    .filter((row) => row.is_read !== true)
    .slice(0, 4);

  return {
    preview,
    unreadTotal,
  };
}
