import type { SupabaseClient } from "@supabase/supabase-js";

/** Terminal cancel states (legacy completed_expired included until backfill everywhere). */
export const P2P_CANCELLED_STATUSES = ["cancelled", "completed_expired"] as const;

const ACTIVE_STATUSES = new Set(["pending_payment", "paid", "disputed"]);

export function isP2pOrderActive(
  status: string,
  expiresAt?: string | null,
): boolean {
  if (!ACTIVE_STATUSES.has(status)) return false;
  if (status === "pending_payment" && expiresAt) {
    return new Date(expiresAt).getTime() > Date.now();
  }
  return true;
}

/** Runs DB expiry for pending_payment past expires_at (30m window). Safe to call often. */
export async function expireStaleP2pOrders(supabase: SupabaseClient): Promise<void> {
  await supabase.rpc("merchant_expire_stale_orders");
}
