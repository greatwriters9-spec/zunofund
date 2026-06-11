"use client";

import { AccountBannedScreen } from "@/components/account/AccountBannedScreen";
import { useAccountStatus } from "@/lib/accountStatus";

export default function AccountBannedPage() {
  const { snapshot, loading } = useAccountStatus();

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#05070D] text-sm text-zinc-400">
        Loading account status…
      </div>
    );
  }

  return <AccountBannedScreen snapshot={snapshot} />;
}
