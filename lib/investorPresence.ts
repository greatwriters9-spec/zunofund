import type { SupabaseClient } from "@supabase/supabase-js";

/** How long after the last trade-page ping an investor still shows as online. */
export const INVESTOR_PRESENCE_STALE_MS = 5 * 60 * 1000;

/** Ping interval while a P2P trade page is open. */
export const INVESTOR_PRESENCE_HEARTBEAT_MS = 60 * 1000;

export function isInvestorTradePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return /^\/p2p\/order\/[^/]+/.test(pathname);
}

export function tradeOrderIdFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(/^\/p2p\/order\/([^/]+)/);
  return m?.[1] ?? null;
}

export async function syncInvestorPresence(
  supabase: SupabaseClient,
  online: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("investor_set_presence", { p_online: online });
  return { error: error ? error.message : null };
}

export function isInvestorEffectivelyOnline(
  isOnline: boolean | null | undefined,
  lastSeenAt: string | null | undefined,
): boolean {
  if (!isOnline) return false;
  if (!lastSeenAt) return false;
  const seenMs = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(seenMs)) return false;
  return Date.now() - seenMs < INVESTOR_PRESENCE_STALE_MS;
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

/** Merchant trade view — investor on the open ticket. */
export function formatInvestorPresence(
  isOnline: boolean | null | undefined,
  lastSeenAt: string | null | undefined,
): { online: boolean; primary: string; secondary: string | null } {
  if (isInvestorEffectivelyOnline(isOnline, lastSeenAt)) {
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
