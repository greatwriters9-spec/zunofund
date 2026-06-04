import { isSupabaseError } from "@/lib/supabase/error";

/** User-safe copy for P2P trade creation / RPC failures. */
export function formatP2pTradeError(error: unknown): string {
  if (error == null) {
    return "Trade could not be started. Please try again.";
  }

  const debug = process.env.NODE_ENV === "development";

  if (isSupabaseError(error)) {
    const raw = error.message?.trim() ?? "";
    const code = "code" in error && typeof error.code === "string" ? error.code : "";

    if (/merchant_orders_side_amounts_chk/i.test(raw)) {
      return "Trade could not be saved due to a platform configuration issue. Please refresh and try again, or contact support if this continues.";
    }

    if (/violates check constraint/i.test(raw)) {
      return "Trade could not be saved. Please refresh the page and try again.";
    }

    const mapped = mapKnownP2pMessage(raw);
    if (mapped) return mapped;

    if (debug && raw) return raw;
    if (raw && isInvestorSafeRpcMessage(raw)) return raw;

    if (code === "PGRST301" || /jwt|session|not authenticated/i.test(raw)) {
      return "Please sign in to start a trade.";
    }
  }

  if (error instanceof Error && error.message) {
    const mapped = mapKnownP2pMessage(error.message);
    if (mapped) return mapped;
    if (debug) return error.message;
    if (isInvestorSafeRpcMessage(error.message)) return error.message;
  }

  return "Trade could not be started. Please try again.";
}

function mapKnownP2pMessage(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("not authenticated")) return "Please sign in to start a trade.";
  if (m.includes("cannot trade on your own offer")) return "You cannot buy or sell on your own offer.";
  if (m.includes("merchants cannot place buy")) return "Merchant accounts must use the merchant dashboard for trades.";
  if (m.includes("merchants cannot open investor sell")) return "Merchant accounts must use the merchant dashboard for trades.";
  if (m.includes("offer not found")) return "This offer is no longer available.";
  if (m.includes("invalid offer")) return "This offer is no longer active.";
  if (m.includes("merchant inactive")) return "This merchant is not available right now.";
  if (m.includes("amount outside offer limits")) return "Amount is outside this offer's min/max limits.";
  if (m.includes("payment method required")) return "Choose a payment method before starting the trade.";
  if (m.includes("payment method not accepted")) return "This offer does not accept that payment method.";
  if (m.includes("insufficient withdrawable") || m.includes("insufficient balance for p2p sell"))
    return "Insufficient withdrawable balance for this trade size.";
  if (m.includes("investor profile not found")) return "Complete your investor profile before trading.";
  if (m.includes("invalid amount") || m.includes("invalid converted amount"))
    return "Enter a valid trade amount.";
  if (m.includes("credit amount must be positive")) return "Trade size is too small after fees.";
  return null;
}

/** Plain-text exceptions raised from P2P RPCs (not internal SQL). */
function isInvestorSafeRpcMessage(message: string): boolean {
  const m = message.trim();
  if (!m || m.length > 200) return false;
  if (/relation |column |syntax |plpgsql|duplicate key|violates/i.test(m)) return false;
  return /^[a-z0-9 ,.'\-]+$/i.test(m);
}

export function logP2pTradeError(context: string, error: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  const detail =
    isSupabaseError(error)
      ? { message: error.message, code: "code" in error ? error.code : undefined, details: "details" in error ? error.details : undefined }
      : error;
  console.error(`[p2p] ${context}`, detail);
}

export type CreateBuyOrderPayload = {
  offerId: string;
  fiatAmount: number;
  paymentMethod: string;
  fxRateUsdAtOpen: number | null;
};

export function validateBuyOrderPayload(
  payload: CreateBuyOrderPayload,
  opts: {
    offerPaymentMethods: string[];
    minFiat: number;
    maxFiat: number;
    merchantUserId: string;
    investorUserId: string | null;
  },
): string | null {
  if (!opts.investorUserId) return "Please sign in to start a trade.";
  if (opts.merchantUserId === opts.investorUserId) return "You cannot buy on your own offer.";
  if (!payload.offerId?.trim()) return "Offer is missing. Refresh and try again.";
  if (!Number.isFinite(payload.fiatAmount) || payload.fiatAmount <= 0) return "Enter a valid amount.";
  if (payload.fiatAmount < opts.minFiat || payload.fiatAmount > opts.maxFiat) {
    return "Amount is outside this offer's limits.";
  }
  const pm = payload.paymentMethod?.trim();
  if (!pm) return "Choose a payment method before starting the trade.";
  if (!opts.offerPaymentMethods.includes(pm)) {
    return "This offer does not accept that payment method.";
  }
  return null;
}
