import type { P2pMarketTab } from "@/components/p2p/p2pTypes";
import type { FxRateMap } from "@/lib/exchangeRates";
import { fiatToUsdt, fromUsd, toUsd } from "@/lib/exchangeRates";
import { formatFiat } from "@/lib/currencies";

export type P2pAssetCode = "USDT" | "BTC";

export type P2pOfferSide = "sell_usdt" | "buy_usdt" | "sell_btc" | "buy_btc";

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
  return asset === "BTC" ? `${n.toFixed(8)} BTC` : `${n.toFixed(2)} USDT`;
}

/** Convert toolbar/prompt input into native crypto units for limit checks + RPC. */
export function inputAmountToCrypto(
  value: number,
  inputUnit: string,
  asset: P2pAssetCode,
  rates: FxRateMap,
): number {
  const unit = (inputUnit || asset).toUpperCase();
  if (unit === asset) return value;
  if (asset === "USDT" && (unit === "USDT" || unit === "USD")) return value;
  const usd =
    unit === "USDT" || unit === "USD"
      ? value
      : toUsd(value, unit, rates);
  if (asset === "BTC") return fromUsd(usd, "BTC", rates);
  return usd;
}

function cryptoToFiat(
  cryptoAmount: number,
  asset: P2pAssetCode,
  fiatCode: string,
  rates: FxRateMap,
): number {
  const usd =
    asset === "BTC"
      ? cryptoAmount * (rates.BTC ?? 70000)
      : cryptoAmount;
  return fromUsd(usd, fiatCode, rates);
}

export function formatLimitRange(
  minCrypto: number,
  maxCrypto: number,
  asset: P2pAssetCode,
  inputCurrency: string,
  rates: FxRateMap,
): string {
  if (inputCurrency !== "USDT" && inputCurrency !== asset) {
    return `${formatFiat(cryptoToFiat(minCrypto, asset, inputCurrency, rates), inputCurrency)} – ${formatFiat(cryptoToFiat(maxCrypto, asset, inputCurrency, rates), inputCurrency)}`;
  }
  return `${fmtAssetAmount(asset, minCrypto)} – ${fmtAssetAmount(asset, maxCrypto)}`;
}

export function minAmountPlaceholder(
  minCrypto: number,
  asset: P2pAssetCode,
  inputCurrency: string,
  rates: FxRateMap,
): string {
  if (inputCurrency !== "USDT" && inputCurrency !== asset) {
    return String(Math.round(cryptoToFiat(minCrypto, asset, inputCurrency, rates)));
  }
  return asset === "BTC" ? minCrypto.toFixed(8) : minCrypto.toFixed(2);
}
