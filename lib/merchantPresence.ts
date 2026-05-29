import type { SupabaseClient } from "@supabase/supabase-js";

/** How long after the last presence ping a merchant still shows as online (auto mode). */
export const MERCHANT_PRESENCE_STALE_MS = 5 * 60 * 1000;

/** Ping interval while merchant console / trade page is open. */
export const MERCHANT_PRESENCE_HEARTBEAT_MS = 60 * 1000;

export type MerchantPresenceMode = "auto" | "manual_online" | "manual_offline";

export function isMerchantPresencePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/merchant") || pathname.startsWith("/p2p/order/");
}

export async function syncMerchantPresence(
  supabase: SupabaseClient,
  online: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("merchant_set_presence", { p_online: online });
  return { error: error ? error.message : null };
}

export async function setMerchantPresenceMode(
  supabase: SupabaseClient,
  mode: MerchantPresenceMode,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("merchant_set_presence_mode", { p_mode: mode });
  return { error: error ? error.message : null };
}

export function isMerchantEffectivelyOnline(
  isOnline: boolean | null | undefined,
  lastSeenAt: string | null | undefined,
  presenceMode?: MerchantPresenceMode | string | null,
): boolean {
  const mode = (presenceMode ?? "auto") as MerchantPresenceMode;
  if (mode === "manual_online") return Boolean(isOnline);
  if (mode === "manual_offline") return false;

  if (!isOnline) return false;
  if (!lastSeenAt) return false;
  const seenMs = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(seenMs)) return false;
  return Date.now() - seenMs < MERCHANT_PRESENCE_STALE_MS;
}

function lastSeenRelative(lastSeenAt: string): string {
  const seenMs = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(seenMs)) return "unknown";

  const diffMs = Math.max(0, Date.now() - seenMs);
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(lastSeenAt).toLocaleDateString();
}

function lastSeenClock(lastSeenAt: string): string {
  const d = new Date(lastSeenAt);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMerchantPresence(
  isOnline: boolean | null | undefined,
  lastSeenAt: string | null | undefined,
  presenceMode?: MerchantPresenceMode | string | null,
): string {
  return formatInvestorMerchantPresence(isOnline, lastSeenAt, presenceMode).primary;
}

/** P2P marketplace — respects manual online (no last-seen) vs auto heartbeat. */
export function formatInvestorMerchantPresence(
  isOnline: boolean | null | undefined,
  lastSeenAt: string | null | undefined,
  presenceMode?: MerchantPresenceMode | string | null,
): { online: boolean; primary: string; secondary: string | null } {
  if (isMerchantEffectivelyOnline(isOnline, lastSeenAt, presenceMode)) {
    return { online: true, primary: "Online", secondary: null };
  }

  if (!lastSeenAt) {
    return { online: false, primary: "Offline", secondary: null };
  }

  const rel = lastSeenRelative(lastSeenAt);
  const clock = lastSeenClock(lastSeenAt);
  return {
    online: false,
    primary: rel === "just now" ? "Last seen just now" : `Last seen ${rel}`,
    secondary: clock || null,
  };
}

/** Merchant dashboard visibility card. */
export function merchantPresenceUi(
  liveOnPage: boolean,
  isOnline: boolean | null | undefined,
  lastSeenAt: string | null | undefined,
  presenceMode?: MerchantPresenceMode | string | null,
): { showOnline: boolean; label: string } {
  const mode = (presenceMode ?? "auto") as MerchantPresenceMode;

  if (mode === "manual_online") {
    return { showOnline: true, label: "Online — stays on while away" };
  }
  if (mode === "manual_offline") {
    return { showOnline: false, label: "Offline — pinned" };
  }

  if (liveOnPage) {
    return { showOnline: true, label: "Online — automatic (this tab open)" };
  }

  return {
    showOnline: isMerchantEffectivelyOnline(isOnline, lastSeenAt, "auto"),
    label: formatMerchantPresence(isOnline, lastSeenAt, "auto"),
  };
}
