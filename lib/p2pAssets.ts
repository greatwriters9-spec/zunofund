import type { P2pMarketTab } from "@/components/p2p/p2pTypes";
import type { FxRateMap } from "@/lib/exchangeRates";
import { formatMoneyAmount } from "@/lib/formatMoney";
import {
  clampFiatToLimits,
  cryptoToFiat,
  fiatToCrypto,
  formatFiatLimitRange,
  inputToOfferFiat,
} from "@/lib/p2pValue";

export type P2pAssetCode = "USDT" | "BTC";

export type P2pOfferSide = "sell_usdt" | "buy_usdt" | "sell_btc" | "buy_btc";

export function merchantOfferSide(tab: P2pMarketTab, asset: P2pAssetCode): P2pOfferSide {
  if (tab === "sell") return asset === "BTC" ? "sell_btc" : "sell_usdt";
  return asset === "BTC" ? "buy_btc" : "buy_usdt";
}

export function p2pOfferSide(tab: P2pMarketTab, asset: P2pAssetCode): P2pOfferSide {
  if (tab === "buy") return asset === "BTC" ? "sell_btc" : "sell_usdt";
  return asset === "BTC" ? "buy_btc" : "buy_usdt";
}

export function assetFromOfferSide(side: string): P2pAssetCode {
  return side.endsWith("_btc") ? "BTC" : "USDT";
}

export function fmtAssetAmount(
  asset: P2pAssetCode,
  value: number | string | null | undefined,
): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return asset === "BTC" ? "0.00000000 BTC" : "0.00 USDT";
  return asset === "BTC" ? `${n.toFixed(8)} BTC` : `${formatMoneyAmount(n)} USDT`;
}

export function inputAmountToCrypto(
  value: number,
  inputUnit: string,
  offerFiatCode: string,
  asset: P2pAssetCode,
  rates: FxRateMap,
): number {
  const fiat = inputToOfferFiat(value, inputUnit, offerFiatCode, rates);
  return fiatToCrypto(fiat, offerFiatCode, asset, rates);
}

export function formatLimitRange(
  minFiat: number,
  maxFiat: number,
  fiatCode: string,
  _asset: P2pAssetCode,
  _inputCurrency: string,
  _rates: FxRateMap,
): string {
  return formatFiatLimitRange(minFiat, maxFiat, fiatCode);
}

export function minAmountPlaceholder(minFiat: number, fiatCode: string): string {
  return String(Math.round(minFiat));
}

export {
  clampFiatToLimits,
  cryptoToFiat,
  fiatToCrypto,
  inputToOfferFiat,
};
