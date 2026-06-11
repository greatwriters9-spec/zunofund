export type WithdrawalDateCommunication = {
  dateLabel: string;
  detail: string;
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

/** Admin-set date shown to investors — informational only; no automatic withdrawals. */
export function getWithdrawalDateCommunication(
  withdrawalEligibleAt: string | null | undefined,
): WithdrawalDateCommunication | null {
  const dateLabel = formatWithdrawalEligibilityLabel(withdrawalEligibleAt);
  if (!dateLabel) return null;

  return {
    dateLabel,
    detail:
      "This date is for your information only. When it arrives, contact administration or support to request a manual withdrawal review.",
  };
}
