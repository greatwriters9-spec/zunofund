import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Building2,
  Coins,
  CreditCard,
  Flame,
  Gift,
  Smartphone,
  Wallet,
} from "lucide-react";

import { P2P_PAYMENT_METHOD_OPTIONS, getP2pPaymentMethodLabel } from "@/lib/p2pPaymentMethods";

export type PaymentMethodItem = {
  code: string;
  label: string;
};

export type PaymentMethodCategory = {
  id: string;
  label: string;
  icon: LucideIcon;
  methods: PaymentMethodItem[];
};

const fromP2p = (codes: string[]): PaymentMethodItem[] =>
  codes
    .map((code) => {
      const opt = P2P_PAYMENT_METHOD_OPTIONS.find((o) => o.code === code);
      return opt ? { code: opt.code, label: opt.label } : null;
    })
    .filter((m): m is PaymentMethodItem => m !== null);

const giftCards: PaymentMethodItem[] = [
  { code: "apple_gift_us", label: "Apple Gift Card (US)" },
  { code: "amazon_gift", label: "Amazon Gift Card" },
  { code: "google_play", label: "Google Play Gift Card" },
  { code: "steam_wallet", label: "Steam Wallet Code" },
  { code: "visa_gift", label: "Visa Gift Card" },
  { code: "ebay_gift", label: "eBay Gift Card" },
  { code: "netflix_gift", label: "Netflix Gift Card" },
  { code: "spotify_gift", label: "Spotify Gift Card" },
];

const bankTransfers: PaymentMethodItem[] = [
  ...fromP2p(["bank_transfer", "western_union", "moneygram", "wise"]),
  { code: "sepa", label: "SEPA Transfer" },
  { code: "ach", label: "ACH Transfer" },
  { code: "swift", label: "SWIFT Wire" },
  { code: "interac", label: "Interac e-Transfer" },
];

const mobileMoney: PaymentMethodItem[] = fromP2p([
  "mpesa",
  "airtel_money",
  "mtn_momo",
  "orangemoney",
  "vodafone_cash",
  "sendwave",
  "worldremit",
  "remitly",
  "flutterwave",
  "chipper_cash",
]);

const digitalWallets: PaymentMethodItem[] = fromP2p([
  "paypal",
  "payoneer",
  "revolut",
  "cash_app",
  "venmo",
  "zelle",
]);

const cashPayments: PaymentMethodItem[] = [
  { code: "cash_in_person", label: "Cash in person" },
  { code: "cash_deposit", label: "Cash deposit" },
  { code: "cash_by_mail", label: "Cash by mail" },
];

const cards: PaymentMethodItem[] = [
  { code: "debit_card", label: "Debit card" },
  { code: "credit_card", label: "Credit card" },
  { code: "prepaid_card", label: "Prepaid card" },
];

const digitalCurrencies: PaymentMethodItem[] = [
  { code: "usdt", label: "USDT" },
  { code: "btc", label: "Bitcoin (BTC)" },
  { code: "eth", label: "Ethereum (ETH)" },
  { code: "usdc", label: "USDC" },
];

export const POPULAR_PAYMENT_METHODS: PaymentMethodItem[] = [
  { code: "gcash", label: "GCash" },
  { code: "bank_transfer", label: "Bank Transfer" },
  { code: "apple_gift_us", label: "Apple Gift Card (US only)" },
  { code: "mpesa", label: "M-Pesa" },
  { code: "paypal", label: "PayPal" },
  { code: "mtn_momo", label: "MTN Mobile Money" },
];

export const PAYMENT_METHOD_CATEGORIES: PaymentMethodCategory[] = [
  {
    id: "popular",
    label: "Popular",
    icon: Flame,
    methods: [
      ...POPULAR_PAYMENT_METHODS,
      ...fromP2p(["bank_transfer", "mpesa", "paypal"]),
    ].filter((m, i, arr) => arr.findIndex((x) => x.code === m.code) === i),
  },
  {
    id: "bank",
    label: "Bank transfers",
    icon: Building2,
    methods: bankTransfers,
  },
  {
    id: "mobile_money",
    label: "Mobile money",
    icon: Smartphone,
    methods: mobileMoney,
  },
  {
    id: "wallets",
    label: "Online wallets",
    icon: Wallet,
    methods: digitalWallets,
  },
  {
    id: "gift_cards",
    label: "Gift cards",
    icon: Gift,
    methods: giftCards,
  },
  {
    id: "cards",
    label: "Debit / credit cards",
    icon: CreditCard,
    methods: cards,
  },
  {
    id: "cash",
    label: "Cash payments",
    icon: Banknote,
    methods: cashPayments,
  },
  {
    id: "digital",
    label: "Digital currencies",
    icon: Coins,
    methods: digitalCurrencies,
  },
  {
    id: "other",
    label: "Other methods",
    icon: Wallet,
    methods: fromP2p(["other"]),
  },
];

export function findPaymentMethodLabel(code: string): string {
  if (!code.trim()) return "All methods";
  const popular = POPULAR_PAYMENT_METHODS.find((m) => m.code === code);
  if (popular) return popular.label;
  for (const cat of PAYMENT_METHOD_CATEGORIES) {
    const m = cat.methods.find((x) => x.code === code);
    if (m) return m.label;
  }
  return getP2pPaymentMethodLabel(code);
}

export function filterPaymentMethods(query: string, categoryId?: string): PaymentMethodItem[] {
  const q = query.trim().toLowerCase();
  const pool = categoryId
    ? (PAYMENT_METHOD_CATEGORIES.find((c) => c.id === categoryId)?.methods ?? [])
    : PAYMENT_METHOD_CATEGORIES.flatMap((c) => c.methods);

  const unique = pool.filter((m, i, arr) => arr.findIndex((x) => x.code === m.code) === i);

  if (!q) return unique;
  return unique.filter(
    (m) => m.label.toLowerCase().includes(q) || m.code.replace(/_/g, " ").includes(q),
  );
}
