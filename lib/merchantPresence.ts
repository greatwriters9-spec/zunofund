import type { SupabaseClient } from "@supabase/supabase-js";

/** How long after the last presence ping a merchant still shows as online (when not on page). */
export const MERCHANT_PRESENCE_STALE_MS = 5 * 60 * 1000;

/** Ping interval while merchant console / trade page is open. */
export const MERCHANT_PRESENCE_HEARTBEAT_MS = 60 * 1000;

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

export function isMerchantEffectivelyOnline(
  isOnline: boolean | null | undefined,
  lastSeenAt: string | null | undefined,
): boolean {
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
): string {
  return formatInvestorMerchantPresence(isOnline, lastSeenAt).primary;
}

/** P2P marketplace offer cards — Online only when flag + fresh heartbeat; otherwise last seen + clock. */
export function formatInvestorMerchantPresence(
  isOnline: boolean | null | undefined,
  lastSeenAt: string | null | undefined,
): { online: boolean; primary: string; secondary: string | null } {
  if (isMerchantEffectivelyOnline(isOnline, lastSeenAt)) {
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

/** Merchant UI: on-page = always Online; away = last seen from DB. */
export function merchantPresenceUi(
  liveOnPage: boolean,
  isOnline: boolean | null | undefined,
  lastSeenAt: string | null | undefined,
): { showOnline: boolean; label: string } {
  if (liveOnPage) {
    return { showOnline: true, label: "Online" };
  }
  return {
    showOnline: isMerchantEffectivelyOnline(isOnline, lastSeenAt),
    label: formatMerchantPresence(isOnline, lastSeenAt),
  };
}
