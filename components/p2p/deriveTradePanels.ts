import type { WorkspaceOrderRow } from "@/components/p2p/workspaceTypes";
import { getP2pPaymentMethodLabel } from "@/lib/p2pPaymentMethods";
import { assetFromOfferSide, fmtAssetAmount } from "@/lib/p2pAssets";
import { formatFiat, getFiatCurrency } from "@/lib/currencies";

/** Clamp long pasted blobs for cards above chat. */
export function clampTradeCopy(raw: string, max = 1100): string {
  const t = raw.trim();
  if (!t.length) return t;
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

export type DerivedTradePanels = {
  tradeLine: string;
  bannerText: string;
  bannerAccent: string;
  summaryMarkdown: string;
  instructionMarkdown: string;
};

/** Copy blocks shown above chat (summaries stripped from timeline). */
export function deriveTradePanels(order: WorkspaceOrderRow, viewerIsMerchant: boolean): DerivedTradePanels {
  const payLabel = getP2pPaymentMethodLabel(order.payment_method);
  const rate = Number(order.rate_percentage).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  // Fiat snapshot stored at order open (Phase 3). Falls back to USD 1:1 on
  // legacy rows so historical trades still render sensibly.
  const fiatCcy = (order.fiat_currency_code ?? "USD") || "USD";
  const fiatAmtNum = Number(order.fiat_amount ?? 0);
  const fxRateNum = Number(order.fx_rate_usd_at_open ?? 1);
  const fiatLabel = fiatAmtNum > 0 ? formatFiat(fiatAmtNum, fiatCcy) : null;
  const showFiatLine = fiatCcy !== "USD" && fiatLabel !== null;
  const fiatMeta = getFiatCurrency(fiatCcy);

  const orderAsset = assetFromOfferSide(order.side);
  const isInvestorBuy = order.side === "sell_usdt" || order.side === "sell_btc";

  if (isInvestorBuy) {
    const amt = fmtAssetAmount(orderAsset, order.amount_requested);
    const cred = fmtAssetAmount(
      orderAsset,
      order.usdt_credit_amount ?? order.btc_credit_amount ?? 0,
    );

    // The merchant sells USDT; the investor pays fiat. Snapshot tells the
    // exact fiat amount the investor must dispatch (`fiat_amount` is net of
    // fee already, computed on `usdt_credit_amount / rate`).
    const bannerAccent = viewerIsMerchant
      ? showFiatLine
        ? `Receive ${fiatLabel} · ${payLabel}`
        : `${amt} · ${payLabel}`
      : showFiatLine
        ? `Pay ${fiatLabel} · receive ≈ ${cred}`
        : `Receive ≈ ${cred} · ${payLabel}`;

    const bannerText = viewerIsMerchant
      ? `Investor buys ${amt} USDT · You sell`
      : showFiatLine
        ? `Buying ${amt} for ${fiatLabel}`
        : `Buying ${amt} (${payLabel})`;

    const tradeLine = viewerIsMerchant
      ? showFiatLine
        ? `They send ${fiatLabel}; release ≈ ${cred} after verification`
        : `They receive ≈ ${cred}`
      : showFiatLine
        ? `You send ${fiatLabel}; receive ${cred} after release`
        : `You will receive ${cred}`;

    const fiatLockedLine = showFiatLine
      ? `\n\nFiat snapshot (locked at open): ${fiatLabel} — rate ${fxRateNum.toPrecision(6)} USD per 1 ${fiatCcy} (${fiatMeta.name}).`
      : "";

    const summary = viewerIsMerchant
      ? `This investor is buying ${amt} from your listing.\n\nOnce their fiat settles off-platform and you release escrow, roughly ${cred} lands in their on-platform wallet.${fiatLockedLine}\n\nMerchant fee tier: ${rate}%. Coordinating channel: ${payLabel}.`
      : `You are buying ${amt} in this escrow.\n\nAfter you’ve sent fiat as agreed and the merchant verifies it, approximately ${cred} will credit your balance.${fiatLockedLine}\n\nMerchant fee: ${rate}%. Coordinating channel: ${payLabel}.`;

    const bespoke = clampTradeCopy(order.merchant_offers?.payment_instructions ?? "");
    const core = bespoke.length
      ? bespoke
      : `No custom bank/till/account lines were saved on this offer. Confirm the precise pay-in destination together in chat; still coordinate through ${payLabel} unless both parties clearly agree otherwise here.`;

    const instructions = viewerIsMerchant
      ? `Fiat pay-in coordinates for your counterparty:\nMirror what follows unless you revise it jointly in-chat.\n\n${core}`
      : `Merchant payment instructions:\nSend fiat strictly per these rails. Messages or screenshots that contradict this escrow should be treated as suspicious.\n\n${core}`;

    return {
      tradeLine,
      bannerText,
      bannerAccent,
      summaryMarkdown: summary,
      instructionMarkdown: instructions,
    };
  }

  const esc = fmtAssetAmount(orderAsset, order.usdt_escrow_amount ?? order.btc_escrow_amount ?? 0);
  const payout = clampTradeCopy(order.investor_payout_instructions ?? "");

  // Investor sells USDT; merchant sends fiat off-platform. Snapshot tells
  // exactly how much fiat the merchant must dispatch.
  const bannerAccent = viewerIsMerchant
    ? showFiatLine
      ? `Send ${fiatLabel} · ${esc} escrowed`
      : `${esc} locked · ${payLabel}`
    : showFiatLine
      ? `Receive ${fiatLabel} · ${esc} escrowed`
      : `${esc} locked · fiat via ${payLabel}`;

  const bannerText = viewerIsMerchant
    ? showFiatLine
      ? `Buying ${esc} for ${fiatLabel}`
      : `Buying ${esc} capacity from investor`
    : showFiatLine
      ? `Selling ${esc} for ${fiatLabel}`
      : `Selling ${esc} (escrowed)`;

  const tradeLine = viewerIsMerchant
    ? showFiatLine
      ? `You send ${fiatLabel}; investor releases ${esc}`
      : "Escrow locked until fiat leg completes"
    : showFiatLine
      ? `You receive ${fiatLabel} after merchant payout`
      : "You will receive fiat off-platform after release";

  const fiatLockedLine = showFiatLine
    ? `\n\nFiat snapshot (locked at open): ${fiatLabel} — rate ${fxRateNum.toPrecision(6)} USD per 1 ${fiatCcy} (${fiatMeta.name}).`
    : "";

  const summary = viewerIsMerchant
    ? `${esc} is escrowed until you fulfil your fiat leg.\nCheck the payout coordinates in-thread, disburse through ${payLabel}, then use Mark as Paid once funds are dispatched.${fiatLockedLine}\nMerchant fee tier: ${rate}%.`
    : `${esc} is escrowed.\nYou'll collect fiat externally using your payout mandate; release USDT once funds have cleared.${fiatLockedLine}\nFee on their listing: ${rate}%. Coordinating rail: ${payLabel}.`;

  const payoutLines =
    payout.length > 0
      ? payout
      : viewerIsMerchant
        ? "(Investor has not yet provided payout details. Wait for them to post their bank / wallet address in chat before disbursing.)"
        : "ACTION REQUIRED: Post your bank account, mobile money, or wallet address in the chat below right now so the merchant knows where to send your fiat. Do not wait — the merchant cannot pay until you provide this.";

  const instructions = viewerIsMerchant
    ? `Seller payout coordinates:\nFiat MUST only route to:\n\n${payoutLines}`
    : payout.length > 0
      ? `Your fiat payout mandate (merchant must honour this):\n\n${payoutLines}`
      : payoutLines;

  return {
    tradeLine,
    bannerText,
    bannerAccent,
    summaryMarkdown: summary,
    instructionMarkdown: instructions,
  };
}
