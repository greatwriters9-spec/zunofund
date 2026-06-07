/** Supported crypto assets across deposits and P2P marketplace UI. */
export const ZUNO_SUPPORTED_CRYPTO_CODES = [
  "BTC",
  "ETH",
  "USDT",
  "USDC",
  "BNB",
  "SOL",
  "XRP",
  "DOGE",
  "TRX",
  "LTC",
] as const;

export type SupportedCryptoCode = (typeof ZUNO_SUPPORTED_CRYPTO_CODES)[number];

export const P2P_RPC_TRADEABLE_ASSETS = new Set<SupportedCryptoCode>(["USDT", "BTC"]);

export function isSupportedCryptoCode(code: string): code is SupportedCryptoCode {
  return ZUNO_SUPPORTED_CRYPTO_CODES.includes(code.toUpperCase() as SupportedCryptoCode);
}

export function normalizeSupportedCryptoCode(code: string): SupportedCryptoCode | null {
  const upper = code.trim().toUpperCase();
  return isSupportedCryptoCode(upper) ? upper : null;
}

export function isP2pRpcTradeableAsset(code: string): code is "USDT" | "BTC" {
  const upper = code.trim().toUpperCase();
  return upper === "USDT" || upper === "BTC";
}

export const CRYPTO_DISPLAY_NAMES: Record<SupportedCryptoCode, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  USDT: "Tether",
  USDC: "USD Coin",
  BNB: "BNB",
  SOL: "Solana",
  XRP: "XRP",
  DOGE: "Dogecoin",
  TRX: "TRON",
  LTC: "Litecoin",
};

export type DepositNetworkPreset = {
  network_name: string;
  network_label: string;
};

/** Suggested networks per asset — admin configures wallet addresses in settings. */
export const DEPOSIT_NETWORK_PRESETS: Record<SupportedCryptoCode, DepositNetworkPreset[]> = {
  BTC: [{ network_name: "Bitcoin", network_label: "Bitcoin" }],
  ETH: [{ network_name: "ERC20", network_label: "Ethereum (ERC20)" }],
  USDT: [
    { network_name: "TRC20", network_label: "TRON (TRC20)" },
    { network_name: "ERC20", network_label: "Ethereum (ERC20)" },
    { network_name: "BEP20", network_label: "BNB Smart Chain (BEP20)" },
  ],
  USDC: [
    { network_name: "ERC20", network_label: "Ethereum (ERC20)" },
    { network_name: "TRC20", network_label: "TRON (TRC20)" },
    { network_name: "BEP20", network_label: "BNB Smart Chain (BEP20)" },
  ],
  BNB: [{ network_name: "BEP20", network_label: "BNB Smart Chain (BEP20)" }],
  SOL: [{ network_name: "Solana", network_label: "Solana" }],
  XRP: [{ network_name: "XRP Ledger", network_label: "XRP Ledger" }],
  DOGE: [{ network_name: "Dogecoin", network_label: "Dogecoin" }],
  TRX: [{ network_name: "TRC20", network_label: "TRON (TRC20)" }],
  LTC: [{ network_name: "Litecoin", network_label: "Litecoin" }],
};

export function supportedCryptoLabel(code: string): string {
  const normalized = normalizeSupportedCryptoCode(code);
  if (!normalized) return code.toUpperCase() || "Crypto";
  return CRYPTO_DISPLAY_NAMES[normalized];
}

export function p2pListingsUnavailableMessage(asset: string): string {
  const symbol = asset.trim().toUpperCase() || "This asset";
  return `P2P listings for ${symbol} are not available yet. Browse USDT or BTC offers to trade now.`;
}
