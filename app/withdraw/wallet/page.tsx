"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Lock, Wallet } from "lucide-react";
import { motion } from "framer-motion";

import {
  DASHBOARD_CARD,
  DASHBOARD_MUTED,
  DASHBOARD_SUCCESS,
} from "@/components/dashboard/premium/dashboardStyles";
import { formatUsdAmount } from "@/lib/formatMoney";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";
import { fromUsd, toUsd } from "@/lib/exchangeRates";
import { useFxRates } from "@/lib/useFx";

const innerCard =
  "rounded-xl border border-white/[0.06] bg-[rgba(12,17,28,0.72)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

const inputCls =
  "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-white outline-none transition placeholder:text-zinc-500 focus:border-[#D4AF37]/40 focus:bg-white/[0.05] focus:ring-2 focus:ring-[#D4AF37]/15";

export default function WithdrawWalletPage() {
  const supabase = useSupabase();
  const { rates: fxRates } = useFxRates();

  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("BTC");

  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [withdrawableBalance, setWithdrawableBalance] = useState<number>(0);
  const [lockedPrincipal, setLockedPrincipal] = useState<number>(0);

  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isBtc = paymentMethod === "BTC";

  const displayTotal = useMemo(
    () => (isBtc ? fromUsd(totalBalance, "BTC", fxRates) : totalBalance),
    [isBtc, totalBalance, fxRates],
  );

  const displayWithdrawable = useMemo(
    () => (isBtc ? fromUsd(withdrawableBalance, "BTC", fxRates) : withdrawableBalance),
    [isBtc, withdrawableBalance, fxRates],
  );

  useEffect(() => {
    fetchInvestorBalance();
  }, []);

  async function fetchInvestorBalance() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) return;

    const { data, error } = await supabase
      .from("investors")
      .select("balance, withdrawable_balance")
      .eq("email", user.email)
      .single();

    if (!error && data) {
      setTotalBalance(Number(data.balance) || 0);
      setWithdrawableBalance(
        Number((data as { withdrawable_balance?: number }).withdrawable_balance) ||
          0,
      );
      setLockedPrincipal(
        Number((data as { locked_principal_balance?: number }).locked_principal_balance) ||
          0,
      );
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const withdrawalAmount = Number(amount);

    if (!amount || withdrawalAmount <= 0) {
      setErrorMessage("Please enter a valid withdrawal amount.");
      return;
    }

    if (!walletAddress.trim()) {
      setErrorMessage("Please enter your wallet address.");
      return;
    }

    const usdtNeeded = isBtc
      ? toUsd(withdrawalAmount, "BTC", fxRates)
      : withdrawalAmount;

    if (usdtNeeded > withdrawableBalance) {
      setErrorMessage(
        "That amount exceeds what you can withdraw right now. Check your available balance below.",
      );
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      setErrorMessage("User authentication failed.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("withdrawals").insert([
      {
        user_id: user.id,
        investor_email: user.email?.trim(),
        amount: withdrawalAmount,
        wallet_address: walletAddress,
        payment_method: paymentMethod,
        status: "pending",
      },
    ]);

    setLoading(false);

    if (error) {
      setErrorMessage(formatSupabaseError(error));
      return;
    }

    setSuccessMessage("success");

    setAmount("");
    setWalletAddress("");

    fetchInvestorBalance();
  }

  return (
    <main className="relative min-h-[calc(100dvh-3.5rem)] overflow-x-clip bg-[#05070D] text-white lg:min-h-[calc(100dvh-3.5rem)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,rgba(212,175,55,0.09)_0%,transparent_70%)]"
        aria-hidden
      />

      <div className="relative mx-auto w-full max-w-2xl px-4 py-5 sm:px-6 sm:py-8">
        <Link
          href="/withdraw"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D4AF37] transition hover:text-[#F5E6B3]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Withdraw options
        </Link>

        <header className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
            On-chain
          </p>
          <div className="mt-2 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37]/25">
              <Wallet className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Withdraw to wallet
              </h1>
              <p className="mt-1 text-xs leading-relaxed sm:text-sm" style={{ color: DASHBOARD_MUTED }}>
                Standard withdrawal request — reviewed before funds are sent on-chain.
              </p>
            </div>
          </div>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={`${DASHBOARD_CARD} mt-8 p-5 sm:p-6`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={`p-4 ${innerCard}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: DASHBOARD_MUTED }}>
                Total portfolio
              </p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-white">
                {isBtc
                  ? `${displayTotal.toFixed(8)} BTC`
                  : formatUsdAmount(displayTotal)}
              </p>
            </div>
            <div className={`p-4 ${innerCard}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: DASHBOARD_MUTED }}>
                Available now
              </p>
              <p className="mt-2 text-lg font-semibold tabular-nums" style={{ color: DASHBOARD_SUCCESS }}>
                {isBtc
                  ? `${displayWithdrawable.toFixed(8)} BTC`
                  : formatUsdAmount(displayWithdrawable)}
              </p>
            </div>
          </div>

          {!isBtc && lockedPrincipal > 0 ? (
            <div className={`mt-3 flex items-start gap-2.5 p-4 ${innerCard}`}>
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden />
              <p className="text-sm leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
                Locked principal (wallet, 30-day rule):{" "}
                <span className="font-semibold text-[#F5E6B3]">{formatUsdAmount(lockedPrincipal)}</span>
                {" — sell on "}
                <Link href="/p2p/sell" className="font-semibold text-[#D4AF37] hover:text-[#F5E6B3]">
                  P2P
                </Link>{" "}
                anytime
              </p>
            </div>
          ) : null}

          {errorMessage ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-5 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            >
              {errorMessage}
            </motion.div>
          ) : null}

          {successMessage ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-5 rounded-xl border border-[#00C076]/30 bg-[#00C076]/[0.08] p-6 text-center"
            >
              <h2 className="text-lg font-semibold text-[#00C076] sm:text-xl">
                Withdrawal request submitted
              </h2>
              <p className="mt-2 text-sm" style={{ color: DASHBOARD_MUTED }}>
                Your withdrawal is pending approval.
              </p>
              <button
                type="button"
                onClick={() => (window.location.href = "/dashboard")}
                className="mt-5 rounded-xl bg-gradient-to-r from-[#F7E3A0] via-[#D4AF37] to-[#EAC54F] px-6 py-3 text-sm font-bold text-black shadow-[0_0_24px_rgba(212,175,55,0.2)] transition hover:brightness-105"
              >
                Return to Dashboard
              </button>
            </motion.div>
          ) : null}

          <form onSubmit={handleWithdraw} className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider" style={{ color: DASHBOARD_MUTED }}>
                Withdrawal amount
              </label>
              <input
                type="number"
                placeholder="Enter withdrawal amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider" style={{ color: DASHBOARD_MUTED }}>
                Wallet address
              </label>
              <input
                type="text"
                placeholder="Enter wallet address"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider" style={{ color: DASHBOARD_MUTED }}>
                Payment method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={inputCls}
              >
                <option value="BTC">Bitcoin (BTC)</option>
                <option value="USDT">USDT</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[#F7E3A0] via-[#D4AF37] to-[#EAC54F] py-3.5 text-sm font-bold text-black shadow-[0_0_24px_rgba(212,175,55,0.2)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Processing…" : "Submit withdrawal"}
            </button>
          </form>
        </motion.div>
      </div>
    </main>
  );
}
