"use client";

import { AccountRestrictedPage } from "@/components/account/AccountRestrictedPage";
import { useAccountStatus } from "@/lib/accountStatus";

export default function AccountSuspendedPage() {
  const { snapshot, loading } = useAccountStatus();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-400">
        Loading account status…
      </div>
    );
  }

  return (
    <AccountRestrictedPage
      variant="suspended"
      fullName={snapshot?.full_name ?? ""}
      email={snapshot?.email ?? ""}
      balance={snapshot?.balance ?? 0}
      reason={snapshot?.status_reason ?? null}
      withdrawalEligibleAt={snapshot?.withdrawal_eligible_at}
    />
  );
}
