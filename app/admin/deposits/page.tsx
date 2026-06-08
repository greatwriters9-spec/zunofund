"use client";

import { useEffect, useState } from "react";
import { formatUsdAmount } from "@/lib/formatMoney";
import { useSupabase, formatSupabaseError } from "@/lib/supabase";

interface Deposit {
  id: string;
  investor_email: string;
  amount: number;
  txid: string;
  payment_method: string;
  deposit_network?: string | null;
  deposit_wallet_address?: string | null;
  referral_code?: string | null;
  status: string;
  created_at: string;
  admin_note?: string | null;
}

export default function AdminDepositsPage() {
  const supabase = useSupabase();

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    void fetchDeposits();
  }, []);

  async function fetchDeposits() {
    setLoading(true);

    const { data, error } = await supabase
      .from("deposits")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setDeposits(data);
    }

    setLoading(false);
  }

  async function approveDeposit(id: string) {
    setBusyId(id);
    setFeedback(null);

    const { error } = await supabase.rpc("approve_deposit", {
      p_deposit_id: id,
    });
    setBusyId(null);
    if (error) {
      setFeedback({ kind: "error", text: formatSupabaseError(error) });
      return;
    }
    setFeedback({ kind: "success", text: "Deposit approved successfully." });

    void fetchDeposits();
  }

  async function rejectDeposit(id: string) {
    const note = window.prompt("Optional note for the investor (leave blank to skip):");
    if (note === null) return;

    setBusyId(id);
    setFeedback(null);

    const { error } = await supabase.rpc("reject_deposit", {
      p_deposit_id: id,
      p_admin_note: note.trim() || null,
    });
    setBusyId(null);
    if (error) {
      setFeedback({ kind: "error", text: formatSupabaseError(error) });
      return;
    }
    setFeedback({ kind: "success", text: "Deposit rejected." });

    void fetchDeposits();
  }

  return (
    <div className="min-h-screen p-6 text-white">
      <h1 className="mb-8 text-4xl font-bold text-yellow-500">Deposit Requests</h1>

      {feedback ? (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            feedback.kind === "success"
              ? "border-green-500/60 bg-green-500/10 text-green-300"
              : "border-red-500/60 bg-red-500/10 text-red-300"
          }`}
          role="status"
        >
          {feedback.text}
        </div>
      ) : null}

      {loading ? (
        <p className="text-gray-400">Loading deposits...</p>
      ) : deposits.length === 0 ? (
        <p className="text-gray-400">No deposit requests found.</p>
      ) : (
        <div className="space-y-4">
          {deposits.map((deposit) => (
            <div
              key={deposit.id}
              className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
            >
              <div>
                <p className="text-lg font-semibold">{deposit.investor_email}</p>

                <p className="mt-1 text-gray-400">Amount: {formatUsdAmount(deposit.amount)}</p>

                <p className="text-gray-400">TXID: {deposit.txid}</p>

                <p className="text-gray-400">Method: {deposit.payment_method}</p>

                {deposit.deposit_network ? (
                  <p className="text-gray-400">Network: {deposit.deposit_network}</p>
                ) : null}

                {deposit.deposit_wallet_address ? (
                  <p className="max-w-xl break-all text-gray-400">
                    Wallet: {deposit.deposit_wallet_address}
                  </p>
                ) : null}

                {deposit.referral_code ? (
                  <p className="text-gray-400">
                    Referral code:{" "}
                    <span className="font-mono text-yellow-300">{deposit.referral_code}</span>
                  </p>
                ) : null}

                {deposit.admin_note?.trim() ? (
                  <p className="mt-2 text-sm text-zinc-500">Note: {deposit.admin_note.trim()}</p>
                ) : null}

                <p
                  className={`mt-2 font-medium ${
                    deposit.status === "approved" || deposit.status === "resolved"
                      ? "text-green-500"
                      : deposit.status === "pending"
                        ? "text-yellow-500"
                        : deposit.status === "disputed"
                          ? "text-violet-400"
                          : "text-red-500"
                  }`}
                >
                  Status:{" "}
                  {deposit.status === "disputed"
                    ? "Disputed (funds held)"
                    : deposit.status === "resolved"
                      ? "Resolved"
                      : deposit.status}
                </p>
              </div>

              {deposit.status === "pending" ? (
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void approveDeposit(deposit.id)}
                    className="rounded-xl bg-green-600 px-6 py-3 font-semibold transition hover:bg-green-700 disabled:opacity-50"
                  >
                    {busyId === deposit.id ? "…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void rejectDeposit(deposit.id)}
                    className="rounded-xl border border-red-500/45 bg-red-500/10 px-6 py-3 font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
