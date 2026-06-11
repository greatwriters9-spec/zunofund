"use client";

import { WithdrawalDateNotice } from "@/components/account/WithdrawalDateNotice";
import { useAccountStatus } from "@/lib/accountStatus";

export function AccountOnHoldBanner() {
  const { status, snapshot } = useAccountStatus();

  if (status !== "on_hold") return null;

  return (
    <div
      className="border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100"
      role="status"
    >
      <p className="font-semibold text-yellow-200">⚠ Account On Hold</p>
      <p className="mt-1 text-yellow-100/90">
        Your account is currently under review. Certain account functions have been temporarily
        restricted. Please contact support for further information.
      </p>
      {snapshot?.status_reason ? (
        <p className="mt-2 rounded-lg border border-yellow-500/20 bg-black/20 px-3 py-2 text-yellow-50/90">
          <span className="font-medium text-yellow-200">Reason: </span>
          {snapshot.status_reason}
        </p>
      ) : null}
      <WithdrawalDateNotice
        withdrawalEligibleAt={snapshot?.withdrawal_eligible_at}
        variant="compact"
      />
    </div>
  );
}
