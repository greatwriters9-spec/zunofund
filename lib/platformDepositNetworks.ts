import {
  normalizeSupportedCryptoCode,
  supportedCryptoLabel,
  type SupportedCryptoCode,
} from "@/lib/supportedCrypto";

export type DepositAssetCode = SupportedCryptoCode;

export type PlatformDepositNetwork = {
  id: string;
  asset: DepositAssetCode;
  network_name: string;
  network_label: string;
  wallet_address: string;
  sort_order: number;
  is_active: boolean;
  updated_at?: string | null;
};

/** Loaded from `platform_deposit_networks` — no hardcoded wallet addresses. */
export const DEFAULT_PLATFORM_DEPOSIT_NETWORKS: PlatformDepositNetwork[] = [];

export function depositAssetLabel(asset: string): string {
  return supportedCryptoLabel(asset);
}

function normalizeAsset(raw: unknown): DepositAssetCode | null {
  return normalizeSupportedCryptoCode(String(raw ?? ""));
}

/** Legacy DB rows used "BSC" before presets standardized on "BEP20". */
function normalizeNetworkName(asset: DepositAssetCode, networkName: string): string {
  const trimmed = networkName.trim();
  if (asset === "USDT" && trimmed.toUpperCase() === "BSC") return "BEP20";
  return trimmed;
}

function toNetwork(
  row: Partial<PlatformDepositNetwork>,
  fallbackOrder: number,
): PlatformDepositNetwork | null {
  const asset = normalizeAsset(row.asset);
  if (!asset) return null;
  const networkName = normalizeNetworkName(asset, String(row.network_name ?? ""));
  const walletAddress = String(row.wallet_address ?? "").trim();
  if (!networkName || !walletAddress) return null;

  const sortOrder = Number(row.sort_order);
  const networkLabel = String(row.network_label ?? "").trim();
  return {
    id: String(row.id ?? `deposit-network-${fallbackOrder}`),
    asset,
    network_name: networkName,
    network_label: networkLabel || networkName,
    wallet_address: walletAddress,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : fallbackOrder,
    is_active: row.is_active !== false,
    updated_at: row.updated_at ?? null,
  };
}

export function normalizePlatformDepositNetworkRows(
  rows: Partial<PlatformDepositNetwork>[] | null | undefined,
): PlatformDepositNetwork[] {
  return (rows ?? [])
    .map((row, index) => toNetwork(row, index))
    .filter((row): row is PlatformDepositNetwork => row !== null)
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.asset.localeCompare(b.asset) ||
        a.network_name.localeCompare(b.network_name),
    );
}
