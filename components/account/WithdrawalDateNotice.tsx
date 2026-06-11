"use client";

import {
  formatWithdrawalEligibilityLabel,
  getWithdrawalDateCommunication,
} from "@/lib/accountStatus/withdrawalEligibility";

type WithdrawalDateNoticeProps = {
  withdrawalEligibleAt: string | null | undefined;
  variant?: "prominent" | "compact";
};

export function WithdrawalDateNotice({
  withdrawalEligibleAt,
  variant = "prominent",
}: WithdrawalDateNoticeProps) {
  const communication = getWithdrawalDateCommunication(withdrawalEligibleAt);
  if (!communication) return null;

  if (variant === "compact") {
    return (
      <p className="mt-2 rounded-lg border border-[#D4AF37]/20 bg-[#D4AF37]/5 px-3 py-2 text-xs leading-relaxed text-zinc-300">
        <span className="font-medium text-[#F5E6B3]">Withdrawal review: </span>
        {communication.dateLabel}. {communication.detail}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#F5E6B3]">
        Scheduled withdrawal review
      </p>
      <p className="mt-1 text-xl font-semibold text-white">{communication.dateLabel}</p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{communication.detail}</p>
    </div>
  );
}
