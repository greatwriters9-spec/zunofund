import {
  CRYPTO_ASSET_CATALOG,
  type CryptoAssetItem,
} from "@/components/market-pickers/cryptoCatalog";
import {
  CRYPTO_DISPLAY_NAMES,
  ZUNO_SUPPORTED_CRYPTO_CODES,
  type SupportedCryptoCode,
} from "@/lib/supportedCrypto";

export const DEPOSIT_EXCHANGE_COIN_CODES = ZUNO_SUPPORTED_CRYPTO_CODES;

export type DepositExchangeCoinCode = SupportedCryptoCode;

const CATALOG_ICON_COLORS: Partial<Record<SupportedCryptoCode, string>> = {
  XRP: "#23292F",
  DOGE: "#C2A633",
};

export const DEPOSIT_EXCHANGE_ASSETS: CryptoAssetItem[] = DEPOSIT_EXCHANGE_COIN_CODES.map(
  (code) => {
    const fromCatalog = CRYPTO_ASSET_CATALOG.find((item) => item.code === code);
    if (fromCatalog) return fromCatalog;
    return {
      code,
      symbol: code,
      name: CRYPTO_DISPLAY_NAMES[code],
      iconColor: CATALOG_ICON_COLORS[code] ?? "#D4AF37",
      liveOnPlatform: true,
    };
  },
);

export function findDepositExchangeAsset(code: string): CryptoAssetItem | undefined {
  return DEPOSIT_EXCHANGE_ASSETS.find((item) => item.code === code.toUpperCase());
}

export function filterDepositExchangeAssets(query: string): CryptoAssetItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return DEPOSIT_EXCHANGE_ASSETS;
  return DEPOSIT_EXCHANGE_ASSETS.filter(
    (item) =>
      item.symbol.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q),
  );
}
