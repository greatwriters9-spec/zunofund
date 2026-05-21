import type { P2pAssetCode } from "@/lib/p2pAssets";
import type { FxRateMap } from "@/lib/exchangeRates";
import { fromUsd, toUsd } from "@/lib/exchangeRates";
import { formatFiat } from "@/lib/currencies";

export function usdPerUnit(code: string, rates: FxRateMap): number {
  const u = code.toUpperCase();
  if (u === "USD") return 1;
  const v = rates[u];
  return typeof v === "number" && v > 0 ? v : 1;
}

export function toFiatUsd(amount: number, code: string, rates: FxRateMap): number {
  return toUsd(amount, code, rates);
}

export function fromFiatUsd(usd: number, code: string, rates: FxRateMap): number {
  return fromUsd(usd, code, rates);
}

export function cryptoToFiatUsd(amount: number, asset: P2pAssetCode, rates: FxRateMap): number {
  return toUsd(amount, asset, rates);
}

export function fiatToCrypto(
  fiatAmount: number,
  fiatCode: string,
  asset: P2pAssetCode,
  rates: FxRateMap,
): number {
  const usd = toFiatUsd(fiatAmount, fiatCode, rates);
  return fromFiatUsd(usd, asset, rates);
}

export function cryptoToFiat(
  cryptoAmount: number,
  asset: P2pAssetCode,
  fiatCode: string,
  rates: FxRateMap,
): number {
  const usd = cryptoToFiatUsd(cryptoAmount, asset, rates);
  return fromFiatUsd(usd, fiatCode, rates);
}

export function formatFiatLimitRange(
  minFiat: number,
  maxFiat: number,
  fiatCode: string,
): string {
  return `${formatFiat(minFiat, fiatCode)} – ${formatFiat(maxFiat, fiatCode)}`;
}

export function clampFiatToLimits(
  fiatAmount: number,
  minFiat: number,
  maxFiat: number,
): number {
  return Math.min(Math.max(fiatAmount, minFiat), maxFiat);
}

export function fiatAmountInOfferCurrency(
  inputAmount: number,
  inputCurrency: string,
  offerFiatCode: string,
  rates: FxRateMap,
): number {
  const inCur = inputCurrency.toUpperCase();
  const offer = offerFiatCode.toUpperCase();
  if (inCur === offer) return inputAmount;
  const usd = toFiatUsd(inputAmount, inCur, rates);
  return fromFiatUsd(usd, offer, rates);
}

export function investorWithdrawableUsd(
  withdrawableProfit: number,
  withdrawablePrincipal: number,
): number {
  return (Number(withdrawableProfit) || 0) + (Number(withdrawablePrincipal) || 0);
}

export function inputToOfferFiat(
  value: number,
  inputUnit: string,
  offerFiatCode: string,
  rates: FxRateMap,
): number {
  return fiatAmountInOfferCurrency(value, inputUnit, offerFiatCode, rates);
}
