import { formatUsdAmount } from "@/lib/formatMoney";

export type WithdrawalEligibilityInfo = {
  headline: string;
  detail: string;
  /** Formatted withdrawal date when admin set one. */
  withdrawalDateLabel: string | null;
  /** true when the eligibility date is in the past or now. */
  isWithdrawalAvailable: boolean;
};

export function formatWithdrawalEligibilityLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export function getWithdrawalEligibilityInfo(
  balance: number,
  withdrawableBalance: number,
  withdrawalEligibleAt: string | null | undefined,
): WithdrawalEligibilityInfo | null {
  const total = Number.isFinite(balance) ? balance : 0;
  const withdrawable = Number.isFinite(withdrawableBalance) ? withdrawableBalance : 0;

  if (total <= 0 && withdrawable <= 0) {
    return null;
  }

  const amountLabel = formatUsdAmount(Math.max(withdrawable, total));
  const eligibleAt = withdrawalEligibleAt ? new Date(withdrawalEligibleAt) : null;
  const hasValidDate = eligibleAt && !Number.isNaN(eligibleAt.getTime());
  const dateLabel = hasValidDate ? formatWithdrawalEligibilityLabel(withdrawalEligibleAt) : null;
  const now = Date.now();
  const isAvailable = Boolean(hasValidDate && eligibleAt!.getTime() <= now);

  if (hasValidDate && eligibleAt!.getTime() > now) {
    return {
      headline: "Withdrawal scheduled",
      detail: `${amountLabel} will be available for withdrawal on ${dateLabel}.`,
      withdrawalDateLabel: dateLabel,
      isWithdrawalAvailable: false,
    };
  }

  if (hasValidDate && isAvailable) {
    return {
      headline: "Withdrawal available",
      detail: `${amountLabel} is available for withdrawal from ${dateLabel}.`,
      withdrawalDateLabel: dateLabel,
      isWithdrawalAvailable: true,
    };
  }

  return {
    headline: "Withdrawal pending",
    detail: `You have ${amountLabel} in your account. A withdrawal date has not been scheduled yet.`,
    withdrawalDateLabel: null,
    isWithdrawalAvailable: false,
  };
}
