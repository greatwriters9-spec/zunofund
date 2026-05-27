export type DepositAssetCode = "USDT" | "BTC";

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

export const DEFAULT_PLATFORM_DEPOSIT_NETWORKS: PlatformDepositNetwork[] = [
  {
    id: "default-usdt-trc20",
    asset: "USDT",
    network_name: "TRC20",
    network_label: "TRC20",
    wallet_address: "TAuiPnSkC3KsacnPQpJ8b55mbUoCoDzBg5",
    sort_order: 0,
    is_active: true,
  },
  {
    id: "default-usdt-bsc",
    asset: "USDT",
    network_name: "BSC",
    network_label: "BNB Smart Chain (BEP20)",
    wallet_address: "0x48fd2fb89e12ce3d91430319da5616a0df869ccf",
    sort_order: 1,
    is_active: true,
  },
  {
    id: "default-btc-bitcoin",
    asset: "BTC",
    network_name: "Bitcoin",
    network_label: "Bitcoin",
    wallet_address: "1P7RWfvSawJBicW3jocUPUCmat4HhBALF9",
    sort_order: 2,
    is_active: true,
  },
];

export function depositAssetLabel(asset: string): string {
  return asset.toUpperCase() === "BTC" ? "Bitcoin" : "USDT";
}

function normalizeAsset(raw: unknown): DepositAssetCode {
  return String(raw ?? "").toUpperCase() === "BTC" ? "BTC" : "USDT";
}

function toNetwork(
  row: Partial<PlatformDepositNetwork>,
  fallbackOrder: number,
): PlatformDepositNetwork | null {
  const networkName = String(row.network_name ?? "").trim();
  const walletAddress = String(row.wallet_address ?? "").trim();
  if (!networkName || !walletAddress) return null;

  const sortOrder = Number(row.sort_order);
  const networkLabel = String(row.network_label ?? "").trim();
  return {
    id: String(row.id ?? `deposit-network-${fallbackOrder}`),
    asset: normalizeAsset(row.asset),
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
