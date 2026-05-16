"use client";

import { useEffect, useState } from "react";
import { useSupabase, formatSupabaseError } from "@/lib/supabase";

interface Deposit {
  id: string;
  investor_email: string;
  amount: number;
  txid: string;
  payment_method: string;
  status: string;
  created_at: string;
}

export default function AdminDepositsPage() {
  const supabase = useSupabase();

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchDeposits();
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
    setFeedback(null);

    const { error } = await supabase.rpc("approve_deposit", {
      p_deposit_id: id,
    });
    if (error) {
      setFeedback({ kind: "error", text: formatSupabaseError(error) });
      return;
    }
    setFeedback({ kind: "success", text: "Deposit approved successfully." });

    fetchDeposits();
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-4xl font-bold text-yellow-500 mb-8">
        Deposit Requests
      </h1>

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
              className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-lg">
                  {deposit.investor_email}
                </p>

                <p className="text-gray-400 mt-1">
                  Amount: ${deposit.amount}
                </p>

                <p className="text-gray-400">
                  TXID: {deposit.txid}
                </p>

                <p className="text-gray-400">
                  Method: {deposit.payment_method}
                </p>

                <p
                  className={`mt-2 font-medium ${
                    deposit.status === "approved"
                      ? "text-green-500"
                      : deposit.status === "pending"
                      ? "text-yellow-500"
                      : "text-red-500"
                  }`}
                >
                  Status: {deposit.status}
                </p>
              </div>

              {deposit.status !== "approved" && (
                <button
                  onClick={() => approveDeposit(deposit.id)}
                  className="bg-green-600 hover:bg-green-700 transition px-6 py-3 rounded-xl font-semibold"
                >
                  Approve
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}