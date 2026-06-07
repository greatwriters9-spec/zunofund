"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { PortfolioGrowthPanel } from "@/components/dashboard/PortfolioGrowthPanel";
import { DASHBOARD_CARD } from "@/components/dashboard/premium/dashboardStyles";

const RANGES = [
  { id: "1d", label: "1D", days: 1 },
  { id: "7d", label: "7D", days: 7 },
  { id: "30d", label: "30D", days: 30 },
  { id: "90d", label: "90D", days: 90 },
] as const;

export function DashboardAssetGrowthCard() {
  const [activeRange, setActiveRange] = useState<(typeof RANGES)[number]["id"]>("7d");
  const days = RANGES.find((r) => r.id === activeRange)?.days ?? 7;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className={`${DASHBOARD_CARD} flex h-full min-h-[320px] flex-col p-5 sm:p-6`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Asset Growth</h2>
        <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-black/20 p-0.5">
          {RANGES.map((range) => (
            <button
              key={range.id}
              type="button"
              onClick={() => setActiveRange(range.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                activeRange === range.id
                  ? "bg-[#D4AF37]/20 text-[#F5E6B3] ring-1 ring-[#D4AF37]/35"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1">
        <PortfolioGrowthPanel rangeDays={days} />
      </div>

      <Link
        href="/dashboard/growth"
        className="mt-3 self-end text-xs font-medium text-[#D4AF37] transition hover:text-[#F5E6B3]"
      >
        Full analytics →
      </Link>
    </motion.div>
  );
}
