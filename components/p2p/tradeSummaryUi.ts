/** Presentation-only copy for the P2P trade transaction banner. */

function isInvestorBuySide(orderSide: string): boolean {
  return orderSide === "sell_usdt" || orderSide === "sell_btc";
}

export function stripApproxPrefix(value: string): string {
  return value.replace(/^≈\s*/, "").trim();
}

/** Trailing status segments for the chat header badge. */
export function tradeSummaryStatusParts(
  status: string,
  viewerIsMerchant: boolean,
  orderSide: string,
): string[] {
  const investorBuy = isInvestorBuySide(orderSide);

  switch (status) {
    case "pending_payment":
      return ["Rate Locked", "Awaiting Payment"];
    case "paid":
      if (investorBuy) {
        return viewerIsMerchant
          ? ["Payment Confirmed", "Releasing Crypto"]
          : ["Payment Sent", "Awaiting Merchant Confirmation"];
      }
      return viewerIsMerchant
        ? ["Payment Sent", "Awaiting Seller Release"]
        : ["Payment Confirmed", "Releasing Crypto"];
    case "completed":
      return ["Trade Completed"];
    case "disputed":
      return ["Under Review"];
    case "cancelled":
      return ["Trade Cancelled"];
    case "completed_expired":
      return ["Expired"];
    default:
      return [status.replace(/_/g, " ")];
  }
}

export function tradeSummaryHeaderBadge(
  status: string,
  viewerIsMerchant: boolean,
  orderSide: string,
): string {
  const parts = tradeSummaryStatusParts(status, viewerIsMerchant, orderSide);
  return parts[parts.length - 1] ?? "In progress";
}

export type TradeBannerCopyInput = {
  status: string;
  orderSide: string;
  viewerIsMerchant: boolean;
  paymentMethod: string;
  payLabel: string;
  receiveLabel: string;
};

export function tradeBannerMessage({
  status,
  orderSide,
  viewerIsMerchant,
  paymentMethod,
  payLabel,
  receiveLabel,
}: TradeBannerCopyInput): string {
  const receive = stripApproxPrefix(receiveLabel);
  const investorBuy = isInvestorBuySide(orderSide);

  if (investorBuy && !viewerIsMerchant) {
    if (status === "pending_payment") {
      return `You are purchasing approximately ${receive} via ${paymentMethod} for ${payLabel}. The seller's crypto is securely locked in escrow. Make payment using the payment details provided below and then mark the order as paid.`;
    }
    if (status === "paid") {
      return `You marked ${payLabel} as paid for approximately ${receive} via ${paymentMethod}. The seller's crypto remains locked in escrow until they confirm and release.`;
    }
    if (status === "completed") {
      return `You purchased approximately ${receive} via ${paymentMethod} for ${payLabel}. This trade is complete.`;
    }
    if (status === "disputed") {
      return `This trade is under review. Do not send new funds off-platform. Escrow remains locked until an admin resolves the dispute.`;
    }
    if (status === "cancelled" || status === "completed_expired") {
      return `This trade is closed. Do not send new funds unless you jointly coordinate in chat.`;
    }
    return `You are purchasing approximately ${receive} via ${paymentMethod} for ${payLabel}. The seller's crypto is securely locked in escrow.`;
  }

  if (investorBuy && viewerIsMerchant) {
    if (status === "pending_payment") {
      return `You are selling approximately ${receive} via ${paymentMethod} for ${payLabel}. Your crypto is securely locked in escrow. Wait for the buyer to pay, verify funds, then release when satisfied.`;
    }
    if (status === "paid") {
      return `You are selling approximately ${receive} via ${paymentMethod} for ${payLabel}. The buyer marked payment as sent — confirm fiat received, then release crypto.`;
    }
    if (status === "completed") {
      return `You sold approximately ${receive} for ${payLabel} via ${paymentMethod}. This trade is complete.`;
    }
    if (status === "disputed") {
      return `This sale is under admin review. Escrow remains locked until the dispute is resolved.`;
    }
    if (status === "cancelled" || status === "completed_expired") {
      return `This trade is closed. Escrow will follow platform rules for cancellation.`;
    }
    return `You are selling approximately ${receive} via ${paymentMethod} for ${payLabel}. Your crypto is securely locked in escrow.`;
  }

  if (!investorBuy && !viewerIsMerchant) {
    if (status === "pending_payment") {
      return `You are selling approximately ${receive} via ${paymentMethod} for ${payLabel}. Your crypto is securely locked in escrow. Share payout details in chat and release only after you confirm fiat payment.`;
    }
    if (status === "paid") {
      return `You are selling approximately ${receive} via ${paymentMethod} for ${payLabel}. The merchant marked payout sent — verify receipt, then release crypto.`;
    }
    if (status === "completed") {
      return `You sold approximately ${receive} for ${payLabel} via ${paymentMethod}. This trade is complete.`;
    }
    return `You are selling approximately ${receive} via ${paymentMethod} for ${payLabel}. Your crypto is securely locked in escrow.`;
  }

  if (status === "pending_payment") {
    return `You are purchasing approximately ${receive} via ${paymentMethod} for ${payLabel}. The seller's crypto is securely locked in escrow. Send fiat to their payout details, then mark as paid.`;
  }
  if (status === "paid") {
    return `You are purchasing approximately ${receive} via ${paymentMethod} for ${payLabel}. Awaiting the seller to release crypto after payout confirmation.`;
  }
  return `You are purchasing approximately ${receive} via ${paymentMethod} for ${payLabel}.`;
}

export type TradeSummaryInstructionInput = TradeBannerCopyInput & {
  ratePercent: number;
};

/** @deprecated Use tradeBannerMessage */
export function tradeSummaryInstruction(input: TradeSummaryInstructionInput): string {
  return tradeBannerMessage(input);
}

/** @deprecated Use tradeBannerMessage */
export function tradeBannerCopy(input: TradeBannerCopyInput) {
  const message = tradeBannerMessage(input);
  return {
    headline: message,
    escrowLine: "",
    actionLine: "",
    receiveColumnLabel: "Receive",
    payColumnLabel: "You pay",
  };
}
