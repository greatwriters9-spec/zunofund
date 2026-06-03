/** Tradeable on Zuno P2P marketplace today. */
export const ZUNO_LIVE_CRYPTO_CODES = new Set(["USDT", "BTC"]);

export type CryptoAssetItem = {
  code: string;
  symbol: string;
  name: string;
  iconColor: string;
  /** Live in the authenticated P2P portal (not used to restrict landing picks). */
  liveOnPlatform: boolean;
};

const LIVE = (code: string) => ZUNO_LIVE_CRYPTO_CODES.has(code);

export const CRYPTO_ASSET_CATALOG: CryptoAssetItem[] = [
  {
    code: "ALL",
    symbol: "ALL",
    name: "All crypto",
    iconColor: "#D4AF37",
    liveOnPlatform: true,
  },
  {
    code: "BTC",
    symbol: "BTC",
    name: "Bitcoin",
    iconColor: "#F7931A",
    liveOnPlatform: LIVE("BTC"),
  },
  {
    code: "USDT",
    symbol: "USDT",
    name: "Tether",
    iconColor: "#26A17B",
    liveOnPlatform: LIVE("USDT"),
  },
  {
    code: "ETH",
    symbol: "ETH",
    name: "Ethereum",
    iconColor: "#627EEA",
    liveOnPlatform: LIVE("ETH"),
  },
  {
    code: "USDC",
    symbol: "USDC",
    name: "USD Coin",
    iconColor: "#2775CA",
    liveOnPlatform: LIVE("USDC"),
  },
  {
    code: "SOL",
    symbol: "SOL",
    name: "Solana",
    iconColor: "#9945FF",
    liveOnPlatform: LIVE("SOL"),
  },
  {
    code: "XMR",
    symbol: "XMR",
    name: "Monero",
    iconColor: "#FF6600",
    liveOnPlatform: LIVE("XMR"),
  },
  {
    code: "TON",
    symbol: "TON",
    name: "Toncoin",
    iconColor: "#0098EA",
    liveOnPlatform: LIVE("TON"),
  },
  {
    code: "BNB",
    symbol: "BNB",
    name: "BNB",
    iconColor: "#F3BA2F",
    liveOnPlatform: LIVE("BNB"),
  },
  {
    code: "LTC",
    symbol: "LTC",
    name: "Litecoin",
    iconColor: "#345D9D",
    liveOnPlatform: LIVE("LTC"),
  },
  {
    code: "BCH",
    symbol: "BCH",
    name: "Bitcoin Cash",
    iconColor: "#8DC351",
    liveOnPlatform: LIVE("BCH"),
  },
  {
    code: "TRX",
    symbol: "TRX",
    name: "TRON",
    iconColor: "#EF0027",
    liveOnPlatform: LIVE("TRX"),
  },
];

export function getCryptoListForContext(context: "landing" | "portal"): CryptoAssetItem[] {
  return CRYPTO_ASSET_CATALOG.filter((c) => context === "landing" || c.code !== "ALL");
}

export function findCryptoLabel(code: string, _context: "landing" | "portal" = "portal"): string {
  const item = CRYPTO_ASSET_CATALOG.find((c) => c.code === code);
  if (item) return item.code === "ALL" ? "All crypto" : item.symbol;
  if (code === "ALL") return "All crypto";
  return code || "Cryptocurrency";
}

export function filterCryptoAssets(
  query: string,
  context: "landing" | "portal",
): CryptoAssetItem[] {
  const q = query.trim().toLowerCase();
  const list = getCryptoListForContext(context);
  if (!q) return list;
  return list.filter(
    (c) =>
      c.symbol.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q),
  );
}

/** Portal: only live assets can be selected. Landing: any listed asset. */
export function canSelectCrypto(asset: CryptoAssetItem, context: "landing" | "portal"): boolean {
  return context === "landing" ? true : asset.liveOnPlatform;
}

export function showCryptoComingSoon(asset: CryptoAssetItem, context: "landing" | "portal"): boolean {
  return context === "portal" && !asset.liveOnPlatform;
}
