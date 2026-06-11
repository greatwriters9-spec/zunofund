"use client";

import { LogOut } from "lucide-react";

import {
  formatWithdrawalEligibilityLabel,
  getWithdrawalEligibilityInfo,
} from "@/lib/accountStatus/withdrawalEligibility";
import { formatUsdAmount } from "@/lib/formatMoney";
import { useSupabase } from "@/lib/supabase";
import type { AccountStatusSnapshot } from "@/lib/accountStatus";

type AccountBannedScreenProps = {
  snapshot: AccountStatusSnapshot | null;
};

export function AccountBannedScreen({ snapshot }: AccountBannedScreenProps) {
  const supabase = useSupabase();

  const balance = snapshot?.balance ?? 0;
  const withdrawableBalance = balance;
  const withdrawalEligibleAt = snapshot?.withdrawal_eligible_at ?? null;
  const withdrawalDateLabel = formatWithdrawalEligibilityLabel(withdrawalEligibleAt);
  const hasScheduledDate = Boolean(withdrawalEligibleAt && withdrawalDateLabel);
  const withdrawalInfo = getWithdrawalEligibilityInfo(
    balance,
    withdrawableBalance,
    withdrawalEligibleAt,
  );

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    window.location.href = "/auth";
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#05070D] text-white">
      <header className="border-b border-zinc-800/80 px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
          <p className="text-sm font-semibold tracking-[0.18em] text-red-400">ACCOUNT BANNED</p>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-red-500/25 bg-zinc-950/95 p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Your account has been banned</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Platform access is restricted. Your account details and fund status are shown below.
          </p>

          {snapshot?.status_reason ? (
            <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Reason</p>
              <p className="mt-1 text-sm text-red-50">{snapshot.status_reason}</p>
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-black/30 px-4 py-3">
              <p className="text-xs text-zinc-500">Account</p>
              <p className="mt-1 text-sm font-medium text-white">
                {snapshot?.full_name?.trim() || "—"}
              </p>
              <p className="text-xs text-zinc-400">{snapshot?.email ?? ""}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-black/30 px-4 py-3">
              <p className="text-xs text-zinc-500">Withdrawable balance</p>
              <p className="mt-1 text-lg font-semibold text-[#F5E6B3]">
                {formatUsdAmount(withdrawableBalance)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Full account balance</p>
            </div>
          </div>

          {hasScheduledDate ? (
            <div className="mt-3 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#F5E6B3]">
                Withdrawal available from
              </p>
              <p className="mt-1 text-xl font-semibold text-white">{withdrawalDateLabel}</p>
              {withdrawableBalance > 0 && withdrawalInfo ? (
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                  {withdrawalInfo.detail}
                </p>
              ) : null}
            </div>
          ) : withdrawalInfo ? (
            <div className="mt-5 rounded-xl border border-zinc-700 bg-black/30 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {withdrawalInfo.headline}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-300">{withdrawalInfo.detail}</p>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
