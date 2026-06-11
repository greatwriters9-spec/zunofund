"use client";

import Link from "next/link";

import { useAccountStatus } from "@/lib/accountStatus";
import type { AccountAction } from "@/lib/accountStatus/access";
import { ACCOUNT_STATUS_LABEL } from "@/lib/accountStatus/labels";

type AccountActionBlockedNoticeProps = {
  action: AccountAction;
  actionLabel?: string;
};

export function AccountActionBlockedNotice({
  action,
  actionLabel,
}: AccountActionBlockedNoticeProps) {
  const { canPerform, snapshot, status } = useAccountStatus();

  if (canPerform(action)) return null;

  const label = actionLabel ?? action.replace(/_/g, " ");

  return (
    <div
      className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
      role="alert"
    >
      <p className="font-semibold text-amber-200">
        {label.charAt(0).toUpperCase() + label.slice(1)} unavailable
      </p>
      <p className="mt-1 text-amber-100/90">
        Your account is {ACCOUNT_STATUS_LABEL[status]}. This action is temporarily restricted.
      </p>
      {snapshot?.status_reason ? (
        <p className="mt-2 text-amber-50/90">Reason: {snapshot.status_reason}</p>
      ) : null}
      <Link href="/support" className="mt-3 inline-block text-xs font-semibold text-[#F5E6B3] underline">
        Contact support
      </Link>
    </div>
  );
}
