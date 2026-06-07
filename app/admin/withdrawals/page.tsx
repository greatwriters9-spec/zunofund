"use client";

import { useEffect, useState } from "react";
import { formatUsdAmount } from "@/lib/formatMoney";
import { useSupabase, formatSupabaseError } from "@/lib/supabase";

interface Withdrawal {
  id: string;
  investor_email: string;
  amount: number;
  wallet_address: string;
  payment_method: string;
  status: string;
  created_at: string;
  merchant_order_id?: string | null;
  admin_note?: string | null;
}

export default function AdminWithdrawalsPage() {
  const supabase = useSupabase();

  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    void fetchWithdrawals();
  }, []);

  async function fetchWithdrawals() {
    setLoading(true);

    const { data, error } = await supabase
      .from("withdrawals")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setWithdrawals(data);
    }

    setLoading(false);
  }

  async function approveWithdrawal(id: string) {
    const confirmApproval = confirm("Are you sure you want to approve this withdrawal?");
    if (!confirmApproval) return;

    setBusyId(id);
    setFeedback(null);

    const { error } = await supabase.rpc("approve_withdrawal", {
      p_withdrawal_id: id,
    });
    setBusyId(null);

    if (error) {
      setFeedback({ kind: "error", text: formatSupabaseError(error) });
      return;
    }

    setFeedback({ kind: "success", text: "Withdrawal approved successfully." });

    void fetchWithdrawals();
  }

  async function rejectWithdrawal(id: string) {
    const note = window.prompt("Optional note for the investor (leave blank to skip):");
    if (note === null) return;

    setBusyId(id);
    setFeedback(null);

    const { error } = await supabase.rpc("reject_withdrawal", {
      p_withdrawal_id: id,
      p_admin_note: note.trim() || null,
    });
    setBusyId(null);

    if (error) {
      setFeedback({ kind: "error", text: formatSupabaseError(error) });
      return;
    }

    setFeedback({ kind: "success", text: "Withdrawal rejected and funds restored." });

    void fetchWithdrawals();
  }

  return (
    <div className="min-h-screen p-6 text-white">
      <h1 className="mb-8 text-4xl font-bold text-yellow-500">Withdrawal Requests</h1>

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
        <p className="text-gray-400">Loading withdrawals...</p>
      ) : withdrawals.length === 0 ? (
        <p className="text-gray-400">No withdrawal requests found.</p>
      ) : (
        <div className="space-y-4">
          {withdrawals.map((withdrawal) => {
            const isPending = withdrawal.status === "pending";
            const isP2pLinked = Boolean(withdrawal.merchant_order_id);

            return (
              <div
                key={withdrawal.id}
                className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
              >
                <div>
                  <p className="text-lg font-semibold">{withdrawal.investor_email}</p>

                  <p className="mt-1 text-gray-400">Amount: {formatUsdAmount(withdrawal.amount)}</p>

                  <p className="text-gray-400">Wallet: {withdrawal.wallet_address}</p>

                  <p className="text-gray-400">Method: {withdrawal.payment_method}</p>

                  {isP2pLinked ? (
                    <p className="mt-1 text-xs text-zinc-500">P2P-linked withdrawal</p>
                  ) : null}

                  {withdrawal.admin_note?.trim() ? (
                    <p className="mt-2 text-sm text-zinc-500">Note: {withdrawal.admin_note.trim()}</p>
                  ) : null}

                  <p
                    className={`mt-2 font-medium ${
                      withdrawal.status === "approved"
                        ? "text-green-500"
                        : withdrawal.status === "pending"
                          ? "text-yellow-500"
                          : "text-red-500"
                    }`}
                  >
                    Status: {withdrawal.status}
                  </p>
                </div>

                {isPending && !isP2pLinked ? (
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => void approveWithdrawal(withdrawal.id)}
                      className="rounded-xl bg-green-600 px-6 py-3 font-semibold transition hover:bg-green-700 disabled:opacity-50"
                    >
                      {busyId === withdrawal.id ? "…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => void rejectWithdrawal(withdrawal.id)}
                      className="rounded-xl border border-red-500/45 bg-red-500/10 px-6 py-3 font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
