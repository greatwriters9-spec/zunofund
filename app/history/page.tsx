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

import { formatMoneyAmount, formatUsdAmount } from "@/lib/formatMoney";
import { useSupabase } from "@/lib/supabase";

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

    if (!user?.id) {
      setLoading(false);
      return;
    }

    const { data: rows, error } = await supabase.rpc(
      "investor_recent_transactions",
      { p_limit: 250 },
    );

    if (error) {
      console.error(error);
      setTransactions([]);
      setLoading(false);
      return;
    }

    type RpcTxn = {
      id: string;
      txn_type: string;
      amount: number;
      status: string;
      description: string | null;
      created_at: string;
    };

    const mergedTransactions = ((rows ?? []) as RpcTxn[]).reduce<
      Transaction[]
    >((acc, item) => {
      const t = item.txn_type;
      if (t !== "deposit" && t !== "withdrawal" && t !== "profit") {
        return acc;
      }
      acc.push({
        id: item.id,
        type: t,
        amount: Number(item.amount),
        status: item.status || "completed",
        description: item.description ?? undefined,
        created_at: item.created_at,
      });
      return acc;
    }, []);

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
    <div className="relative min-h-screen overflow-hidden text-white">
      <div className="relative z-10 mx-auto max-w-7xl p-5 md:p-7">

        <header className="mb-5 border-b border-zinc-800/80 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Activity
              </p>
              <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                Transaction history
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                Combined deposits, withdrawals, and profits — newest first (up to 250 rows).
              </p>
            </div>
            <Link
              href="/dashboard"
              className="shrink-0 text-xs font-semibold text-yellow-500 transition hover:text-yellow-400"
            >
              ← Dashboard
            </Link>
          </div>
        </header>

        <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-zinc-800/80 px-1 pb-px">
          {(["all", "deposit", "withdrawal", "profit"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`shrink-0 border-b-2 px-3 pb-2 pt-1 text-sm font-medium capitalize transition ${
                activeFilter === filter
                  ? "border-yellow-500 text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden border border-zinc-800/80 bg-zinc-950/40 lg:rounded-lg"
        >

          {/* Table Header */}
          <div className="hidden md:grid md:grid-cols-5 md:gap-4 border-b border-zinc-800/80 p-4 text-xs font-medium uppercase tracking-wide text-zinc-500 sm:px-5">
            <div>Transaction</div>
            <div>Status</div>
            <div>Description</div>
            <div>Date</div>
            <div className="text-right">
              Amount
            </div>
          </div>

          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-zinc-500 sm:px-5">
              Loading transactions…
            </div>
          ) : filteredTransactions.length > 0 ? (
            filteredTransactions.map((transaction) => {
              const statusUi =
                transaction.status === "approved"
                  ? "bg-green-500/10 text-green-500"
                  : transaction.status === "pending"
                    ? "bg-yellow-500/10 text-yellow-500"
                    : "bg-zinc-800 text-gray-300";

              const amountPrefix =
                transaction.type === "withdrawal" ? "-" : "+";

              return (
                <div
                  key={transaction.id}
                  className="border-b border-zinc-800/80 transition last:border-b-0 md:hover:bg-zinc-900/30"
                >
                  <div className="flex items-center justify-between gap-3 px-4 py-3 md:hidden sm:px-5">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-black/40">
                        {getTransactionIcon(transaction.type)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold capitalize text-white">
                          {transaction.type}
                        </h3>
                        <p className="truncate text-xs text-zinc-600">
                          {transaction.description}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`shrink-0 text-sm font-bold tabular-nums ${getAmountColor(
                        transaction.type,
                      )}`}
                    >
                      {amountPrefix}
                      {formatUsdAmount(transaction.amount)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800/40 px-4 py-2 md:hidden sm:px-5">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ${statusUi}`}
                    >
                      {transaction.status}
                    </span>
                    <span className="text-[11px] tabular-nums text-zinc-600">
                      {new Date(transaction.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="hidden md:grid md:grid-cols-5 md:gap-4 md:px-5 md:py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-black/40">
                        {getTransactionIcon(transaction.type)}
                      </div>
                      <span className="text-sm font-semibold capitalize text-white">
                        {transaction.type}
                      </span>
                    </div>

                    <div className="flex items-center">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ${statusUi}`}
                      >
                        {transaction.status}
                      </span>
                    </div>

                    <div className="flex items-center text-sm text-zinc-400">
                      {transaction.description}
                    </div>

                    <div className="flex items-center text-xs tabular-nums text-zinc-600">
                      {new Date(transaction.created_at).toLocaleString()}
                    </div>

                    <div
                      className={`flex items-center justify-end text-base font-bold tabular-nums ${getAmountColor(
                        transaction.type,
                      )}`}
                    >
                      {amountPrefix}
                      {formatUsdAmount(transaction.amount)}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-4 py-14 text-center text-sm text-zinc-500 sm:px-5">
              No transactions in this view.
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}