"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";
import { fromUsd, toUsd } from "@/lib/exchangeRates";
import { useFxRates } from "@/lib/useFx";
import { motion } from "framer-motion";

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
      .select("balance, withdrawable_balance, locked_principal_balance")
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
        "That amount exceeds what you can withdraw right now. New deposits unlock after 30 days; daily profits are withdrawable sooner — see totals below.",
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
    <div className="flex min-h-screen items-center justify-center p-6 text-white">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950/70 p-8 backdrop-blur-xl"
      >
        <p className="mb-4 text-sm text-zinc-500">
          <Link href="/withdraw" className="text-yellow-500 hover:underline">
            ← Withdraw options
          </Link>
        </p>

        <h1 className="mb-2 text-4xl font-bold text-yellow-500">
          Withdraw to wallet
        </h1>

        <p className="mb-6 text-sm text-zinc-500">
          Standard withdrawal request (existing flow).
        </p>

        <div className="mb-6 space-y-2 text-sm text-gray-400">
          <p>
            Total portfolio:{" "}
            <span className="font-semibold text-white">
              {isBtc
                ? `${displayTotal.toFixed(8)} BTC`
                : `$${displayTotal.toFixed(2)}`}
            </span>
          </p>
          <p>
            <span className="font-semibold text-green-500">
              Available to withdraw now:{" "}
              {isBtc
                ? `${displayWithdrawable.toFixed(8)} BTC`
                : `$${displayWithdrawable.toFixed(2)}`}
            </span>
          </p>
          {!isBtc && (
            <p>
              Locked principal (30-day rule per deposit):{" "}
              <span className="font-semibold text-yellow-500/90">
                ${lockedPrincipal.toFixed(2)}
              </span>
            </p>
          )}
        </div>

        {errorMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-5 rounded-xl border border-red-500 bg-red-500/10 px-4 py-3 text-red-400"
          >
            {errorMessage}
          </motion.div>
        )}

        {successMessage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 rounded-2xl border border-green-500 bg-green-500/10 p-6 text-center"
          >
            <h2 className="mb-2 text-2xl font-bold text-green-400">
              Withdrawal Request Submitted Successfully
            </h2>

            <p className="mb-6 text-gray-300">
              Your withdrawal request is now pending approval.
            </p>

            <button
              type="button"
              onClick={() => (window.location.href = "/dashboard")}
              className="rounded-xl bg-yellow-500 px-6 py-3 font-bold text-black transition hover:bg-yellow-600"
            >
              Return to Dashboard
            </button>
          </motion.div>
        )}

        <form onSubmit={handleWithdraw} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-gray-400">
              Withdrawal Amount
            </label>

            <input
              type="number"
              placeholder="Enter withdrawal amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-400">
              Wallet Address
            </label>

            <input
              type="text"
              placeholder="Enter wallet address"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-400">
              Payment Method
            </label>

            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-yellow-500"
            >
              <option value="BTC">Bitcoin (BTC)</option>
              <option value="USDT">USDT</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-yellow-500 py-3 font-bold text-black transition hover:bg-yellow-600 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Submit Withdrawal"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
