import type { OfferCardRow } from "@/components/p2p/OfferCard";
import { assetFromOfferSide, type P2pAssetCode } from "@/lib/p2pAssets";
import {
  clampFiatToLimits,
  fiatToCrypto,
  formatFiatLimitRange,
  inputToOfferFiat,
} from "@/lib/p2pValue";
import type { FxRateMap } from "@/lib/exchangeRates";

export type ResolveTradeAmountOpts = {
  inputCurrency?: string;
  asset?: P2pAssetCode;
  rates?: FxRateMap;
};

export function resolveTradeAmount(
  row: OfferCardRow,
  amountInput: string,
  opts?: ResolveTradeAmountOpts,
): { fiatAmount: number; cryptoAmount: number; error?: string } {
  const asset = opts?.asset ?? assetFromOfferSide(row.side);
  const inputCurrency = (opts?.inputCurrency || row.fiat_currency_code || "USD").toUpperCase();
  const rates = opts?.rates ?? { USD: 1, USDT: 1, BTC: 70000 };
  const fiatCode = (row.fiat_currency_code || "USD").toUpperCase();
  const minFiat = Number(row.min_limit);
  const maxFiat = Number(row.max_limit);

  const parsed = Number(amountInput);
  if (Number.isFinite(parsed) && parsed > 0) {
    const fiatAmount = inputToOfferFiat(parsed, inputCurrency, fiatCode, rates);
    if (fiatAmount < minFiat || fiatAmount > maxFiat) {
      return {
        fiatAmount: 0,
        cryptoAmount: 0,
        error: `Amount must be between ${formatFiatLimitRange(minFiat, maxFiat, fiatCode)} for this ad.`,
      };
    }
    return {
      fiatAmount,
      cryptoAmount: fiatToCrypto(fiatAmount, fiatCode, asset, rates),
    };
  }
  const fiatAmount = minFiat;
  return {
    fiatAmount,
    cryptoAmount: fiatToCrypto(fiatAmount, fiatCode, asset, rates),
  };
}
