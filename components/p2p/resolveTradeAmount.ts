import type { OfferCardRow } from "@/components/p2p/OfferCard";
import {
  assetFromOfferSide,
  formatLimitRange,
  inputAmountToCrypto,
  type P2pAssetCode,
} from "@/lib/p2pAssets";
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
): { amount: number; error?: string } {
  const asset = opts?.asset ?? assetFromOfferSide(row.side);
  const inputCurrency = (opts?.inputCurrency || asset).toUpperCase();
  const rates = opts?.rates ?? { USD: 1, USDT: 1, BTC: 70000 };
  const minCrypto = Number(row.min_limit);
  const maxCrypto = Number(row.max_limit);
  const nativeInput = inputCurrency !== asset && inputCurrency !== "USDT";

  const parsed = Number(amountInput);
  if (Number.isFinite(parsed) && parsed > 0) {
    const cryptoAmount = nativeInput
      ? inputAmountToCrypto(parsed, inputCurrency, asset, rates)
      : parsed;

    if (cryptoAmount < minCrypto || cryptoAmount > maxCrypto) {
      return {
        amount: 0,
        error: `Amount must be between ${formatLimitRange(minCrypto, maxCrypto, asset, inputCurrency, rates)} for this ad.`,
      };
    }
    return { amount: cryptoAmount };
  }
  return { amount: minCrypto };
}