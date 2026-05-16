"use client";

import { useEffect, useState } from "react";
import {
  displayPlanName,
  formatDepositRangeDescription,
  normalizeInvestmentPlan,
  validateDepositAmountForPlan,
  type CanonicalInvestmentPlan,
} from "@/lib/investmentPlans";
import { useSupabase, formatSupabaseError } from "@/lib/supabase";

export default function DepositPage() {
  const supabase = useSupabase();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("USDT");
  const [txid, setTxid] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const walletAddress =
  paymentMethod === "USDT"
    ? "TAuiPnSkC3KsacnPQpJ8b55mbUoCoDzBg5"
    : "1P7RWfvSawJBicW3jocUPUCmat4HhBALF9";
const selectedNetwork =
  paymentMethod === "USDT"
    ? "TRC20"
    : "Bitcoin";

  const [copied, setCopied] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [planSlug, setPlanSlug] =
    useState<CanonicalInvestmentPlan>("Starter");
  const [planLoadError, setPlanLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadPlan() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        if (!cancelled) {
          setPlanSlug("Starter");
          setPlanLoadError(null);
        }
        return;
      }
      const { data, error } = await supabase
        .from("investors")
        .select("investment_plan")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setPlanLoadError(formatSupabaseError(error));
        return;
      }
      setPlanLoadError(null);
      setPlanSlug(normalizeInvestmentPlan(data?.investment_plan));
    }
    loadPlan();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

async function copyWallet() {
  await navigator.clipboard.writeText(walletAddress);

  setCopied(true);

  setTimeout(() => {
    setCopied(false);
  }, 2500);
}

  async function handleDeposit() {
    setFormError(null);
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setFormError("Please sign in to submit a deposit request.");
      setLoading(false);
      return;
    }

    const numAmount = Number(amount);
    const planMsg = validateDepositAmountForPlan(numAmount, planSlug);
    if (planMsg) {
      setFormError(planMsg);
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("deposits").insert([
      {
        user_id: user.id,
        investor_email: user.email,
        amount: numAmount,
        txid,
        payment_method: paymentMethod,
        status: "pending",
      },
    ]);

    if (error) {
      setFormError(formatSupabaseError(error));
      setLoading(false);
      return;
    }

    setSubmitted(true);

    setAmount("");
    setTxid("");
    setLoading(false);
  }

  // SUCCESS SCREEN
  if (submitted) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-10 text-center">

          <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl text-yellow-500">✓</span>
          </div>

          <h1 className="text-4xl font-bold text-yellow-500 mb-4">
            Request Received
          </h1>

          <p className="text-zinc-400 text-lg leading-relaxed">
            Your investment request has been received successfully and will be processed within 30 minutes.
          </p>

          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="mt-8 bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-8 py-3 rounded-2xl transition-all"
          >
            Return to Dashboard
          </button>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl p-8">

        <h1 className="text-4xl font-bold text-yellow-500 mb-2">
          Deposit Funds
        </h1>

        <p className="text-zinc-500 mb-6">
          Submit your investment deposit request
        </p>

        {formError ? (
          <div
            className="mb-6 rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            role="alert"
          >
            {formError}
          </div>
        ) : null}

        {planLoadError ? (
          <div
            className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
            role="status"
          >
            Could not load your plan: {planLoadError}
          </div>
        ) : null}

        <div className="mb-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
  <p className="text-yellow-400 font-semibold">
    Your tier: {displayPlanName(planSlug)}
  </p>

  <p className="text-sm text-zinc-400 mt-1">
    Allowed deposit window for requests:{" "}
    <span className="text-yellow-400 font-medium">
      {formatDepositRangeDescription(planSlug)} USD
    </span>
    . Change tiers on Investment Plans if you need different limits.
  </p>

  <p className="text-xs text-zinc-500 mt-2">
    The server enforces the same bounds when you submit—amounts outside this
    range are rejected automatically.
  </p>
</div>

        <div className="mb-4">
          <label className="block mb-3 text-zinc-400">
            Payment Method
          </label>

          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-yellow-500"
          >
            <option>USDT</option>
            <option>Bitcoin</option>
            <option>Ethereum</option>
          </select>
        </div>

        <div className="mb-4">
  <label className="block mb-3 text-zinc-400">
    Selected Network
  </label>

  <div className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-yellow-500 font-semibold">
    {selectedNetwork}
  </div>
</div>

<div className="mb-4">
  <label className="block mb-3 text-zinc-400">
    Wallet Address
  </label>

  <div className="flex gap-3">
    <input
      type="text"
      value={walletAddress}
      readOnly
      className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 py-3 outline-none text-white"
    />

    <button
      onClick={copyWallet}
      className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-5 rounded-xl transition"
    >
      Copy
    </button>
  </div>
</div>
{copied && (
  <p className="text-green-400 text-sm mt-2">
    Wallet address copied successfully.
  </p>
)}

        <div className="mb-4">
          <label className="block mb-3 text-zinc-400">
            Deposit Amount
          </label>

          <input
            type="number"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-yellow-500"
          />
        </div>

        <div className="mb-6">
          <label className="block mb-3 text-zinc-400">
            Transaction Hash (TXID)
          </label>

          <input
            type="text"
            placeholder="Enter blockchain transaction hash"
            value={txid}
            onChange={(e) => setTxid(e.target.value)}
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-yellow-500"
          />
        </div>

        <div className="mb-6 rounded-2xl border border-zinc-800 bg-black/40 p-4">
  <h3 className="text-xl font-semibold text-white mb-4">
    Deposit Instructions
  </h3>

  <ol className="space-y-3 text-zinc-400 text-sm leading-relaxed list-decimal pl-5">
    <li>Open your crypto wallet or exchange.</li>

    <li>Copy the wallet address above.</li>

    <li>Send the exact amount you wish to deposit.</li>

    <li>Paste your transaction hash (TXID).</li>

    <li>Submit your deposit request.</li>
  </ol>
</div>

<div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
  <h3 className="text-red-400 font-semibold mb-2">
    Important Notice
  </h3>

  <p className="text-zinc-300 text-sm leading-relaxed">
    Always copy and paste the wallet address correctly before making payment.
    Sending funds to the wrong address or incorrect network may result in permanent loss of funds.
  </p>
</div>

        <button
          onClick={handleDeposit}
          disabled={loading}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-all"
        >
          {loading ? "Submitting..." : "I HAVE MADE PAYMENT"}
        </button>

      </div>
    </main>
  );
}