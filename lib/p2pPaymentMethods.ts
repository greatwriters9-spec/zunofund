/** Codes stored in merchant_offers.payment_methods and passed to RPCs. */
export const P2P_PAYMENT_METHOD_OPTIONS = [
  // Mobile money (Africa-focused)
  { code: "mpesa", label: "M-Pesa" },
  { code: "airtel_money", label: "Airtel Money" },
  { code: "mtn_momo", label: "MTN Mobile Money" },
  { code: "orangemoney", label: "Orange Money" },
  { code: "vodafone_cash", label: "Vodafone Cash" },
  { code: "sendwave", label: "Sendwave" },
  { code: "worldremit", label: "WorldRemit" },
  { code: "remitly", label: "Remitly" },
  { code: "flutterwave", label: "Flutterwave" },
  { code: "chipper_cash", label: "Chipper Cash" },
  // Banks & majors
  { code: "bank_transfer", label: "Bank transfer" },
  { code: "western_union", label: "Western Union" },
  { code: "moneygram", label: "MoneyGram" },
  // Digital wallets
  { code: "wise", label: "Wise" },
  { code: "paypal", label: "PayPal" },
  { code: "payoneer", label: "Payoneer" },
  { code: "revolut", label: "Revolut" },
  { code: "cash_app", label: "Cash App" },
  { code: "venmo", label: "Venmo" },
  { code: "zelle", label: "Zelle" },
  { code: "other", label: "Other (describe in chat)" },
] as const;

export function getP2pPaymentMethodLabel(code: string): string {
  const trimmed = code.trim().toLowerCase();
  const found = P2P_PAYMENT_METHOD_OPTIONS.find((o) => o.code === trimmed);
  return found?.label ?? code.trim();
}
