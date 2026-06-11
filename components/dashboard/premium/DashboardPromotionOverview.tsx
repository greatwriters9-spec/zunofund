"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Megaphone } from "lucide-react";

import { DASHBOARD_CARD, DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";
import { formatUsdAmount } from "@/lib/formatMoney";
import {
  daysUntilPromotionEnd,
  exampleDepositForPlan,
  formatAnnouncementMonthYear,
  pickFeaturedAnnouncement,
  projectedReturnLabel,
  promotionEndLabel,
} from "@/lib/platformConfig/helpers";
import { usePlatformConfig } from "@/lib/platformConfig";

export function DashboardPromotionOverview() {
  const { config } = usePlatformConfig();
  const { plans, promotion, announcements } = config;
  const featured = pickFeaturedAnnouncement(announcements);
  const activePlans = plans.filter((p) => p.promotion_active);
  const tablePlans = activePlans.length > 0 ? activePlans : plans;
  const daysRemaining = promotion?.show_countdown ? daysUntilPromotionEnd(promotion) : 0;

  if (promotion && !promotion.is_active) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.02 }}
      aria-label="Promotion overview"
      className={`${DASHBOARD_CARD} p-5 sm:p-6`}
    >
      <h2 className="text-base font-semibold text-white">
        {promotion?.promotion_title ?? "Promotion Overview"}
      </h2>

      {promotion?.promotion_description ? (
        <p className="mt-2 text-sm" style={{ color: DASHBOARD_MUTED }}>
          {promotion.promotion_description}
        </p>
      ) : null}

      <p className="mt-2 text-sm text-[#D4AF37]">
        Promotion ends {promotionEndLabel(promotion)}
        {promotion?.show_countdown && daysRemaining > 0 ? (
          <span style={{ color: DASHBOARD_MUTED }}> · {daysRemaining} days remaining</span>
        ) : null}
        {promotion?.partner_fund_amount != null && promotion.partner_fund_amount > 0 ? (
          <span style={{ color: DASHBOARD_MUTED }}>
            {" "}
            · Partner fund {formatUsdAmount(promotion.partner_fund_amount)}
          </span>
        ) : null}
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]/90">
                Plan
              </th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]/90">
                Range
              </th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]/90">
                Interest
              </th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]/90">
                Example Deposit
              </th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]/90">
                Projected Returns
              </th>
            </tr>
          </thead>
          <tbody>
            {tablePlans.map((row) => (
              <tr
                key={row.id}
                className="border-b border-white/[0.04] last:border-b-0 even:bg-white/[0.015]"
              >
                <td className="px-3 py-2.5 font-medium text-white">{row.name}</td>
                <td className="px-3 py-2.5" style={{ color: DASHBOARD_MUTED }}>
                  {row.max_deposit >= 999999999
                    ? `${formatUsdAmount(row.min_deposit)}+`
                    : `${formatUsdAmount(row.min_deposit)} — ${formatUsdAmount(row.max_deposit)}`}
                </td>
                <td className="px-3 py-2.5 text-[#F5E6B3]">{row.daily_roi}% daily</td>
                <td className="px-3 py-2.5 text-white">
                  {formatUsdAmount(exampleDepositForPlan(row))}
                </td>
                <td className="px-3 py-2.5 font-medium text-[#D4AF37]">
                  {projectedReturnLabel(row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {featured ? (
        <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-[#D4AF37]" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]/90">
              Latest Update
            </p>
          </div>
          <p className="mt-3 text-sm font-semibold text-white">{featured.title}</p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
            {featured.content}
          </p>
          <p className="mt-3 text-xs" style={{ color: DASHBOARD_MUTED }}>
            Date:{" "}
            <span className="text-white">{formatAnnouncementMonthYear(featured.created_at)}</span>
          </p>
          <Link
            href="/communication-center"
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#D4AF37] transition hover:text-[#F5E6B3]"
          >
            View Full Update
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      ) : null}
    </motion.section>
  );
}
