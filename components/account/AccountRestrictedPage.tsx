"use client";

import Link from "next/link";

import { WithdrawalDateNotice } from "@/components/account/WithdrawalDateNotice";
import { formatUsdAmount } from "@/lib/formatMoney";
import type { AccountStatus } from "@/lib/accountStatus";

type AccountRestrictedPageProps = {
  variant: Extract<AccountStatus, "suspended" | "banned">;
  fullName: string;
  email: string;
  balance: number;
  reason: string | null;
  withdrawalEligibleAt?: string | null;
};

export function AccountRestrictedPage({
  variant,
  fullName,
  email,
  balance,
  reason,
  withdrawalEligibleAt,
}: AccountRestrictedPageProps) {
  const isBanned = variant === "banned";
  const title = isBanned ? "Account Banned" : "Account Suspended";
  const intro = isBanned
    ? "Your account has been restricted from using platform features."
    : "Your account has been temporarily suspended.";

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/90 p-6 sm:p-8">
        <p
          className={`text-xs font-semibold uppercase tracking-[0.2em] ${
            isBanned ? "text-red-400" : "text-orange-400"
          }`}
        >
          Account Status
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{intro}</p>

        {reason ? (
          <div className="mt-5 rounded-xl border border-zinc-700 bg-black/40 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Reason</p>
            <p className="mt-1 text-sm text-zinc-200">{reason}</p>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-black/30 px-4 py-3">
            <p className="text-xs text-zinc-500">Profile</p>
            <p className="mt-1 text-sm font-medium text-white">{fullName || "—"}</p>
            <p className="text-xs text-zinc-400">{email}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-black/30 px-4 py-3">
            <p className="text-xs text-zinc-500">Current Balance</p>
            <p className="mt-1 text-lg font-semibold text-[#F5E6B3]">
              {formatUsdAmount(balance)}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <WithdrawalDateNotice withdrawalEligibleAt={withdrawalEligibleAt} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/support"
            className="inline-flex items-center rounded-xl bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#E5BD45]"
          >
            Contact Support
          </Link>
          {!isBanned ? (
            <Link
              href="/dashboard/profile"
              className="inline-flex items-center rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500"
            >
              View Profile
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
