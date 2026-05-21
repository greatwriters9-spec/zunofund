/** Shared merchant order row used by workspace + panel derivations */

export type WorkspaceOrderRow = {
  id: string;
  investor_user_id: string;
  merchant_user_id: string;
  offer_id: string | null;
  side: "sell_usdt" | "buy_usdt" | "sell_btc" | "buy_btc";
  amount_requested: number;
  rate_percentage: number;
  fee_amount: number;
  usdt_credit_amount: number | null;
  usdt_escrow_amount: number | null;
  btc_credit_amount?: number | null;
  btc_escrow_amount?: number | null;
  locked_btc_amount?: number | null;
  payment_method: string;
  proof_of_payment: string | null;
  investor_payout_instructions?: string | null;
  status: string;
  expires_at: string;
  deposit_id: string | null;
  /** Phase 3 fiat snapshot — locked at order open, never moves. */
  fiat_currency_code?: string | null;
  fiat_amount?: number | null;
  fx_rate_usd_at_open?: number | null;
  merchant_offers: {
    payment_instructions: string | null;
  } | null;
  created_at?: string;
};
