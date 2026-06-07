"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { DASHBOARD_CARD, DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";
import { formatSignedUsdAmount } from "@/lib/formatMoney";
import {
  formatTransactionDate,
  formatTransactionStatus,
  transactionActivityMeta,
  transactionStatusClass,
} from "@/lib/transactionActivity";

export type DashboardActivity = {
  id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
};

type DashboardRecentTransactionsProps = {
  activities: DashboardActivity[];
};

export function DashboardRecentTransactions({ activities }: DashboardRecentTransactionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={`${DASHBOARD_CARD} flex h-full flex-col overflow-hidden`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <h2 className="text-base font-semibold text-white">Recent Transactions</h2>
        <Link href="/history" className="text-xs font-medium text-[#D4AF37] hover:text-[#F5E6B3]">
          View all
        </Link>
      </div>

      <ul className="divide-y divide-white/[0.04]">
        {activities.length > 0 ? (
          activities.map((activity) => {
            const meta = transactionActivityMeta(activity.type);
            const Icon = meta.icon;
            const isWithdrawal = activity.type === "withdrawal";
            return (
              <li
                key={activity.id}
                className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-white/[0.02]"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{meta.label}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-semibold tabular-nums ${
                      isWithdrawal ? "text-red-400" : "text-[#00C076]"
                    }`}
                  >
                    {isWithdrawal
                      ? formatSignedUsdAmount(-Math.abs(Number(activity.amount)))
                      : formatSignedUsdAmount(activity.amount)}
                  </p>
                  <p className={`text-[11px] font-medium ${transactionStatusClass(activity.status)}`}>
                    {formatTransactionStatus(activity.status)}
                  </p>
                  <p className="text-[11px]" style={{ color: DASHBOARD_MUTED }}>
                    {formatTransactionDate(activity.created_at)}
                  </p>
                </div>
              </li>
            );
          })
        ) : (
          <li className="px-5 py-12 text-center text-sm" style={{ color: DASHBOARD_MUTED }}>
            No recent activity.
          </li>
        )}
      </ul>
    </motion.div>
  );
}
