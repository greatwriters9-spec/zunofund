"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";

import { useSupabase } from "@/lib/supabase";
import { notificationsOwnerOrFilter } from "@/lib/notificationQuery";

interface Transaction {
  id: string;
  type: "deposit" | "withdrawal" | "profit";
  amount: number;
  status: string;
  description?: string;
  created_at: string;
}

export default function HistoryPage() {
  const supabase = useSupabase();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeFilter, setActiveFilter] = useState<
    "all" | "deposit" | "withdrawal" | "profit"
  >("all");

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email || !user.id) {
      setLoading(false);
      return;
    }

    // DEPOSITS
    const { data: deposits } = await supabase
      .from("deposits")
      .select("*")
      .ilike("investor_email", user.email.trim());

    // WITHDRAWALS
    const { data: withdrawals } = await supabase
      .from("withdrawals")
      .select("*")
      .ilike("investor_email", user.email.trim());

    // PROFITS (RLS matches user_id OR email — mirror with PostgREST .or(...))
    const profitOwner = notificationsOwnerOrFilter({
      userId: user.id,
      investorEmail: user.email.trim(),
    });

    const { data: profits } = await supabase
      .from("profits")
      .select("*")
      .or(profitOwner);

    const formattedDeposits =
      deposits?.map((item) => ({
        id: item.id,
        type: "deposit" as const,
        amount: Number(item.amount),
        status: item.status || "completed",
        description: item.description || "Deposit",
        created_at: item.created_at,
      })) || [];

    const formattedWithdrawals =
      withdrawals?.map((item) => ({
        id: item.id,
        type: "withdrawal" as const,
        amount: Number(item.amount),
        status: item.status || "completed",
        description: item.description || "Withdrawal",
        created_at: item.created_at,
      })) || [];

    const formattedProfits =
      profits?.map((item) => ({
        id: item.id,
        type: "profit" as const,
        amount: Number(item.amount),
        status: item.status || "completed",
        description: item.description || "Profit Added",
        created_at: item.created_at,
      })) || [];

    const mergedTransactions = [
      ...formattedDeposits,
      ...formattedWithdrawals,
      ...formattedProfits,
    ].sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    );

    setTransactions(mergedTransactions);

    setLoading(false);
  }

  const filteredTransactions = useMemo(() => {
    if (activeFilter === "all") {
      return transactions;
    }

    return transactions.filter(
      (transaction) => transaction.type === activeFilter
    );
  }, [transactions, activeFilter]);

  function getTransactionIcon(type: string) {
    switch (type) {
      case "deposit":
        return (
          <ArrowDownLeft
            className="text-green-500"
            size={20}
          />
        );

      case "withdrawal":
        return (
          <ArrowUpRight
            className="text-red-500"
            size={20}
          />
        );

      case "profit":
        return (
          <TrendingUp
            className="text-yellow-500"
            size={20}
          />
        );

      default:
        return null;
    }
  }

  function getAmountColor(type: string) {
    switch (type) {
      case "withdrawal":
        return "text-red-500";

      case "deposit":
        return "text-green-500";

      case "profit":
        return "text-yellow-500";

      default:
        return "text-white";
    }
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">

      {/* Ambient Background */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-yellow-500/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-yellow-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto p-5 md:p-7">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">

          <div>
            <h1 className="text-4xl font-bold text-yellow-500 mb-2">
              Transaction History
            </h1>

            <p className="text-gray-400">
              Complete financial activity overview.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 hover:border-yellow-500 transition px-5 py-3 rounded-2xl"
          >
            <ArrowLeft size={18} />
            Dashboard
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">

          {[
            "all",
            "deposit",
            "withdrawal",
            "profit",
          ].map((filter) => (
            <button
              key={filter}
              onClick={() =>
                setActiveFilter(
                  filter as
                    | "all"
                    | "deposit"
                    | "withdrawal"
                    | "profit"
                )
              }
              className={`px-5 py-3 rounded-2xl border transition capitalize font-medium ${
                activeFilter === filter
                  ? "bg-yellow-500 text-black border-yellow-500"
                  : "bg-zinc-950 border-zinc-800 hover:border-yellow-500"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden"
        >

          {/* Table Header */}
          <div className="hidden md:grid grid-cols-5 gap-4 p-5 border-b border-zinc-800 text-gray-400 text-sm font-medium">
            <div>Transaction</div>
            <div>Status</div>
            <div>Description</div>
            <div>Date</div>
            <div className="text-right">
              Amount
            </div>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="p-10 text-center text-gray-500">
              Loading transactions...
            </div>
          ) : filteredTransactions.length > 0 ? (
            filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="grid grid-cols-1 md:grid-cols-5 gap-4 p-5 border-b border-zinc-800 hover:bg-zinc-900/40 transition"
              >

                {/* Type */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-black border border-zinc-800 flex items-center justify-center">
                    {getTransactionIcon(
                      transaction.type
                    )}
                  </div>

                  <div>
                    <h3 className="font-semibold capitalize">
                      {transaction.type}
                    </h3>

                    <p className="text-gray-500 text-sm">
                      Transaction
                    </p>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center">
                  <div
                    className={`px-4 py-2 rounded-xl text-sm font-medium ${
                      transaction.status ===
                      "approved"
                        ? "bg-green-500/10 text-green-500"
                        : transaction.status ===
                          "pending"
                        ? "bg-yellow-500/10 text-yellow-500"
                        : "bg-zinc-800 text-gray-300"
                    }`}
                  >
                    {transaction.status}
                  </div>
                </div>

                {/* Description */}
                <div className="flex items-center text-gray-300">
                  {transaction.description}
                </div>

                {/* Date */}
                <div className="flex items-center text-gray-500 text-sm">
                  {new Date(
                    transaction.created_at
                  ).toLocaleString()}
                </div>

                {/* Amount */}
                <div
                  className={`flex items-center justify-start md:justify-end text-2xl font-bold ${getAmountColor(
                    transaction.type
                  )}`}
                >
                  {transaction.type ===
                  "withdrawal"
                    ? "-"
                    : "+"}
                  $
                  {Number(
                    transaction.amount
                  ).toFixed(2)}
                </div>
              </div>
            ))
          ) : (
            <div className="p-16 text-center text-gray-500">
              No transactions found.
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}