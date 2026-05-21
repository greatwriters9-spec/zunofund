export type MerchantOrderCard = {
  id: string;
  side: string;
  status: string;
  amount_requested: number;
  usdt_credit_amount: number | null;
  usdt_escrow_amount: number | null;
  fiat_currency_code: string | null;
  fiat_amount: number | null;
  created_at: string;
  expires_at: string;
  investor: { email: string | null; full_name: string | null } | null;
};
