"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

import { DASHBOARD_CARD, DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";
import { formatSignedUsdAmount } from "@/lib/formatMoney";
import {
  formatTransactionDate,
  formatTransactionStatus,
  transactionActivityMeta,
  transactionStatusClass,
} from "@/lib/transactionActivity";

export type HistoryTransaction = {
  id: string;
  type: "deposit" | "withdrawal" | "profit" | "referral_bonus" | "reward";
  amount: number;
  status: string;
  description?: string;
  created_at: string;
};

const HISTORY_FILTERS = [
  { id: "all", label: "All" },
  { id: "deposit", label: "Deposits" },
  { id: "withdrawal", label: "Withdrawals" },
  { id: "profit", label: "ROI" },
  { id: "referral_bonus", label: "Referrals" },
  { id: "reward", label: "Rewards" },
] as const;

export type HistoryFilter = (typeof HISTORY_FILTERS)[number]["id"];

type TransactionHistoryViewProps = {
  transactions: HistoryTransaction[];
  loading: boolean;
  activeFilter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
};

export function TransactionHistoryView({
  transactions,
  loading,
  activeFilter,
  onFilterChange,
}: TransactionHistoryViewProps) {
  const filtered =
    activeFilter === "all"
      ? transactions
      : transactions.filter((transaction) => transaction.type === activeFilter);

  return (
    <div className="relative min-h-full bg-[#05070D] text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,rgba(212,175,55,0.08)_0%,transparent_70%)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-[1400px] space-y-5 px-4 py-5 pb-6 sm:space-y-6 sm:px-6 sm:pb-8 lg:py-8">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-[#D4AF37]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Dashboard
          </Link>

          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
              Activity
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
              Transaction history
            </h1>
            <p
              className="mt-1.5 text-xs leading-relaxed sm:text-sm"
              style={{ color: DASHBOARD_MUTED }}
            >
              Deposits, withdrawals, ROI, referrals, and rewards — newest first.
            </p>
          </div>
        </motion.header>

        <div
          className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap"
          role="tablist"
          aria-label="Transaction filters"
        >
          {HISTORY_FILTERS.map((filter) => {
            const active = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilterChange(filter.id)}
                className={`min-w-0 rounded-full border px-2.5 py-2 text-center text-[11px] font-semibold transition sm:shrink-0 sm:px-4 sm:text-xs ${
                  active
                    ? "border-[#D4AF37]/35 bg-[#D4AF37]/15 text-[#F5E6B3] shadow-[0_0_20px_rgba(212,175,55,0.12)]"
                    : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-white/[0.14] hover:text-zinc-200"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={`${DASHBOARD_CARD} overflow-hidden`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-base font-semibold text-white">
              {activeFilter === "all"
                ? "All transactions"
                : HISTORY_FILTERS.find((filter) => filter.id === activeFilter)?.label}
            </h2>
            {!loading && filtered.length > 0 ? (
              <span className="text-[11px] font-medium tabular-nums" style={{ color: DASHBOARD_MUTED }}>
                {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="px-5 py-14 text-center text-sm" style={{ color: DASHBOARD_MUTED }}>
              Loading transactions…
            </div>
          ) : filtered.length > 0 ? (
            <ul className="divide-y divide-white/[0.04]">
              {filtered.map((transaction) => {
                const meta = transactionActivityMeta(transaction.type);
                const Icon = meta.icon;
                const isWithdrawal = transaction.type === "withdrawal";

                return (
                  <li
                    key={transaction.id}
                    className="flex items-start gap-3 px-5 py-4 transition hover:bg-white/[0.02] sm:items-center"
                  >
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:mt-0 ${meta.tone}`}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">{meta.label}</p>
                      {transaction.description ? (
                        <p className="mt-0.5 truncate text-xs" style={{ color: DASHBOARD_MUTED }}>
                          {transaction.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="shrink-0 text-right">
                      <p
                        className={`text-sm font-semibold tabular-nums ${
                          isWithdrawal ? "text-red-400" : "text-[#00C076]"
                        }`}
                      >
                        {isWithdrawal
                          ? formatSignedUsdAmount(-Math.abs(Number(transaction.amount)))
                          : formatSignedUsdAmount(transaction.amount)}
                      </p>
                      <p
                        className={`text-[11px] font-medium ${transactionStatusClass(transaction.status)}`}
                      >
                        {formatTransactionStatus(transaction.status)}
                      </p>
                      <p className="text-[11px] tabular-nums" style={{ color: DASHBOARD_MUTED }}>
                        {formatTransactionDate(transaction.created_at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-5 py-14 text-center text-sm" style={{ color: DASHBOARD_MUTED }}>
              No transactions in this view.
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
