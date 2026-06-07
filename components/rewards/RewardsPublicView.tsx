"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Award, Crown, Gift, ShieldCheck, Sparkles, Star, Users } from "lucide-react";

import { DASHBOARD_CARD, DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";

const REWARD_PILLARS = [
  {
    title: "Referral Bonuses",
    description: "Invite new users and earn recurring bonuses when your network stays active.",
    icon: Users,
  },
  {
    title: "Activity Rewards",
    description: "Get rewarded for consistent marketplace participation and investment activity.",
    icon: Sparkles,
  },
  {
    title: "Loyalty Tiers",
    description: "Unlock higher-value perks as your account grows through verified participation.",
    icon: Crown,
  },
  {
    title: "Merchant Unlock Path",
    description: "Progress toward merchant eligibility with bonus accelerators and milestone rewards.",
    icon: ShieldCheck,
  },
] as const;

const BONUS_TIERS = [
  {
    tier: "Starter Bonus",
    reward: "Welcome reward + referral starter credits",
    perks: ["Early member incentives", "Basic referral multipliers", "Monthly promo eligibility"],
  },
  {
    tier: "Growth Bonus",
    reward: "Enhanced rewards multipliers",
    perks: ["Improved referral rates", "Priority promo access", "Activity bonus upgrades"],
  },
  {
    tier: "Pro Bonus",
    reward: "Premium loyalty bonus structure",
    perks: ["Higher volume incentives", "Exclusive campaign drops", "Accelerated merchant path"],
  },
  {
    tier: "Elite Bonus",
    reward: "Top-tier ecosystem rewards",
    perks: ["Highest referral multipliers", "VIP reward campaigns", "Priority merchant benefits"],
  },
] as const;

export function RewardsPublicView() {
  return (
    <div className="relative min-h-full bg-[#05070D] text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,rgba(212,175,55,0.08)_0%,transparent_70%)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-[1400px] space-y-6 px-4 py-5 pb-6 sm:space-y-8 sm:px-6 sm:pb-8 lg:py-8">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-[#D4AF37]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Home
          </Link>

          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
              Rewards program
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
              Earn more with <span className="text-[#D4AF37]">Zuno Rewards</span>
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
              Unlock bonuses, loyalty perks, and referral rewards across trading, investing, and
              merchant growth.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/auth?signup=1"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#F7E3A0] via-[#D4AF37] to-[#EAC54F] px-5 py-2.5 text-xs font-bold text-black shadow-[0_0_24px_rgba(212,175,55,0.25)] transition hover:brightness-105"
            >
              <Gift className="h-4 w-4" aria-hidden />
              Create account
            </Link>
            <Link
              href="/auth"
              className="inline-flex items-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-5 py-2.5 text-xs font-semibold text-zinc-100 transition hover:border-white/[0.2]"
            >
              Log in
            </Link>
          </div>
        </motion.header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {REWARD_PILLARS.map(({ title, description, icon: Icon }, i) => (
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`${DASHBOARD_CARD} p-5`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] ring-1 ring-[#D4AF37]/20">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-base font-semibold text-white">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
                {description}
              </p>
            </motion.article>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${DASHBOARD_CARD} overflow-hidden`}
        >
          <div className="border-b border-white/[0.06] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
                  Bonus tiers
                </p>
                <h2 className="mt-1 text-base font-semibold text-white">
                  Tiered bonuses for every growth stage
                </h2>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1 text-[11px] font-medium text-[#F5E6B3]">
                <Star className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                Updated campaigns
              </span>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
            {BONUS_TIERS.map((tier) => (
              <article
                key={tier.tier}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <h3 className="text-sm font-semibold text-[#D4AF37]">{tier.tier}</h3>
                <p className="mt-1.5 text-sm font-medium text-zinc-200">{tier.reward}</p>
                <ul className="mt-3 space-y-1.5 text-xs" style={{ color: DASHBOARD_MUTED }}>
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <Award className="mt-0.5 h-3 w-3 shrink-0 text-[#D4AF37]" aria-hidden />
                      {perk}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
