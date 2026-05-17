"use client";

import { useEffect, useState } from "react";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";
import { motion } from "framer-motion";

export default function WithdrawPage() {
  const supabase = useSupabase();

  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("BTC");

  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [withdrawableBalance, setWithdrawableBalance] = useState<number>(0);
  const [lockedPrincipal, setLockedPrincipal] = useState<number>(0);

  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
      setWithdrawableBalance(Number((data as { withdrawable_balance?: number }).withdrawable_balance) || 0);
      setLockedPrincipal(Number((data as { locked_principal_balance?: number }).locked_principal_balance) || 0);
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const withdrawalAmount = Number(amount);

    // Validate amount
    if (!amount || withdrawalAmount <= 0) {
      setErrorMessage("Please enter a valid withdrawal amount.");
      return;
    }

    // Validate wallet address
    if (!walletAddress.trim()) {
      setErrorMessage("Please enter your wallet address.");
      return;
    }

    // Check balance
    if (withdrawalAmount > withdrawableBalance) {
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
    <div className="min-h-screen text-white p-6 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl p-8"
      >
        <h1 className="text-4xl font-bold text-yellow-500 mb-2">
          Withdraw Funds
        </h1>

        <div className="text-gray-400 mb-6 space-y-2 text-sm">
          <p>
            Total portfolio:{" "}
            <span className="text-white font-semibold">
              ${totalBalance.toFixed(2)}
            </span>
          </p>
          <p>
            <span className="text-green-500 font-semibold">
              Available to withdraw now: ${withdrawableBalance.toFixed(2)}
            </span>
          </p>
          <p>
            Locked principal (30-day rule per deposit):{" "}
            <span className="text-yellow-500/90 font-semibold">
              ${lockedPrincipal.toFixed(2)}
            </span>
          </p>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-5 bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-xl"
          >
            {errorMessage}
          </motion.div>
        )}

        {/* Success Message */}
        {successMessage && (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="mb-6 bg-green-500/10 border border-green-500 rounded-2xl p-6 text-center"
  >
    <h2 className="text-2xl font-bold text-green-400 mb-2">
      Withdrawal Request Submitted Successfully
    </h2>

    <p className="text-gray-300 mb-6">
      Your withdrawal request is now pending approval.
    </p>

    <button
      onClick={() => window.location.href = "/dashboard"}
      className="bg-yellow-500 hover:bg-yellow-600 transition text-black font-bold px-6 py-3 rounded-xl"
    >
      Return to Dashboard
    </button>
  </motion.div>
)}

        <form onSubmit={handleWithdraw} className="space-y-5">
          <div>
            <label className="block mb-2 text-sm text-gray-400">
              Withdrawal Amount
            </label>

            <input
              type="number"
              placeholder="Enter withdrawal amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm text-gray-400">
              Wallet Address
            </label>

            <input
              type="text"
              placeholder="Enter wallet address"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm text-gray-400">
              Payment Method
            </label>

            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 outline-none focus:border-yellow-500"
            >
              <option value="BTC">Bitcoin (BTC)</option>
              <option value="ETH">Ethereum (ETH)</option>
              <option value="USDT">USDT</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-600 transition text-black font-bold py-3 rounded-xl disabled:opacity-50"
          >
            {loading ? "Processing..." : "Submit Withdrawal"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}