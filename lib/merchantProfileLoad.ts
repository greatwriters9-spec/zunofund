import type { SupabaseClient } from "@supabase/supabase-js";

import type { MerchantPresenceMode } from "@/lib/merchantPresence";

export type MerchantProfileRow = {
  user_id: string;
  display_name: string | null;
  status: string;
  is_online: boolean | null;
  last_seen_at: string | null;
  presence_mode: MerchantPresenceMode;
};

const BASE_FIELDS =
  "user_id, display_name, status, is_online, last_seen_at";

/** Loads merchant profile; defaults presence_mode to auto if column not migrated yet. */
export async function fetchMerchantProfileRow(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ profile: MerchantProfileRow | null; error: string | null }> {
  const withMode = await supabase
    .from("merchant_profiles")
    .select(`${BASE_FIELDS}, presence_mode`)
    .eq("user_id", userId)
    .maybeSingle();

  if (!withMode.error && withMode.data) {
    const row = withMode.data as Record<string, unknown>;
    return {
      profile: {
        user_id: String(row.user_id),
        display_name: (row.display_name as string | null) ?? null,
        status: String(row.status ?? ""),
        is_online: row.is_online as boolean | null,
        last_seen_at: (row.last_seen_at as string | null) ?? null,
        presence_mode: (row.presence_mode as MerchantPresenceMode) ?? "auto",
      },
      error: null,
    };
  }

  const fallback = await supabase
    .from("merchant_profiles")
    .select(BASE_FIELDS)
    .eq("user_id", userId)
    .maybeSingle();

  if (fallback.error) {
    return { profile: null, error: fallback.error.message };
  }

  if (!fallback.data) {
    return { profile: null, error: null };
  }

  const row = fallback.data as Record<string, unknown>;
  return {
    profile: {
      user_id: String(row.user_id),
      display_name: (row.display_name as string | null) ?? null,
      status: String(row.status ?? ""),
      is_online: row.is_online as boolean | null,
      last_seen_at: (row.last_seen_at as string | null) ?? null,
      presence_mode: "auto",
    },
    error: null,
  };
}
