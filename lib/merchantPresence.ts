export function formatMerchantPresence(
  isOnline: boolean | null | undefined,
  lastSeenAt: string | null | undefined,
): string {
  if (isOnline) return "Online";
  if (!lastSeenAt) return "Last seen unavailable";

  const seenMs = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(seenMs)) return "Last seen unavailable";

  const diffMs = Math.max(0, Date.now() - seenMs);
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Last seen just now";
  if (diffMin < 60) return `Last seen ${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Last seen ${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Last seen ${diffDays}d ago`;

  return `Last seen ${new Date(lastSeenAt).toLocaleDateString()}`;
}
