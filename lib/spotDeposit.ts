import { sanitizeNextParam } from "@/lib/authLinks";

export const SPOT_NETWORK_WARNING =
  "Only send the selected asset using the selected network. Deposits sent using unsupported networks may be permanently lost.";

export function spotDepositPath(asset: string, networkId?: string): string {
  const params = new URLSearchParams();
  const normalizedAsset = asset.trim().toUpperCase();
  if (normalizedAsset) params.set("asset", normalizedAsset);
  if (networkId?.trim()) params.set("network", networkId.trim());
  const query = params.toString();
  return query ? `/spot/deposit?${query}` : "/spot/deposit";
}

export function spotDepositPathFromSearch(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return spotDepositPath(params.get("asset") ?? "", params.get("network") ?? undefined);
}

export function landingSpotSectionPath(asset?: string, networkId?: string): string {
  const base = "/#mobile-marketplace";
  if (!asset?.trim()) return base;
  const params = new URLSearchParams({ asset: asset.trim().toUpperCase() });
  if (networkId?.trim()) params.set("network", networkId.trim());
  return `${base}?${params.toString()}`;
}

export function resolveSpotDepositNext(
  raw: string | null | undefined,
  fallback = "/spot/deposit",
): string {
  return sanitizeNextParam(raw) ?? fallback;
}
