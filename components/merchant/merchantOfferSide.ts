import type { P2pAssetCode } from "@/lib/p2pAssets";
import type { P2pMarketTab } from "@/components/p2p/p2pTypes";

export function parseMerchantOfferSide(side: string): { asset: P2pAssetCode; tab: P2pMarketTab } {
  const isBuy = side.startsWith("buy_");
  const asset: P2pAssetCode = side.includes("btc") ? "BTC" : "USDT";
  return { asset, tab: isBuy ? "buy" : "sell" };
}

export function sideLabel(side: string): string {
  if (side === "sell_usdt") return "Sell USDT";
  if (side === "buy_usdt") return "Buy USDT";
  if (side === "sell_btc") return "Sell BTC";
  if (side === "buy_btc") return "Buy BTC";
  return side;
}
