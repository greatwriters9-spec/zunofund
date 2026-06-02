"use client";

import Link from "next/link";
import { Award, Coins, Crown, Gift, ShieldCheck, Sparkles, Star, Users } from "lucide-react";

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

export default function RewardsPage() {
  return (
    <main className="min-h-screen bg-[#05080F] text-white">
      <section className="relative overflow-hidden px-6 pb-16 pt-20 lg:px-10 lg:pt-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(212,175,55,0.14),transparent_38%),radial-gradient(circle_at_85%_18%,rgba(245,230,179,0.08),transparent_34%)]" />

        <div className="relative mx-auto max-w-7xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#F5E6B3]">
            <Award className="h-4 w-4 text-[#D4AF37]" />
            Rewards Program
          </div>

          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight md:text-5xl lg:text-6xl">
            Earn More With <span className="text-[#D4AF37]">Zuno Rewards</span>
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-zinc-400 md:text-lg">
            Unlock bonuses, loyalty perks, and referral rewards through one unified ecosystem. This public rewards page
            shows how incentives work across trading, investing, and merchant growth.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/auth?signup=1"
              className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#E5BD45]"
            >
              <Gift className="h-4 w-4" />
              Create Account
            </Link>
            <Link
              href="/auth?signup=1"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/70 px-6 py-3 text-sm font-semibold text-zinc-100 transition hover:border-[#D4AF37]/55 hover:text-white"
            >
              <Coins className="h-4 w-4 text-[#D4AF37]" />
              Explore Marketplace
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 pb-16 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 xl:grid-cols-4">
          {REWARD_PILLARS.map(({ title, description, icon: Icon }) => (
            <article
              key={title}
              className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
            >
              <div className="mb-4 inline-flex rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 p-2.5">
                <Icon className="h-5 w-5 text-[#D4AF37]" />
              </div>
              <h2 className="text-xl font-bold text-white">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-6 pb-16 lg:px-10">
        <div className="mx-auto max-w-7xl rounded-[30px] border border-zinc-800 bg-gradient-to-br from-[#0f1624] to-[#090d15] p-7 md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">Bonus Tiers</p>
              <h2 className="mt-2 text-3xl font-black text-white md:text-4xl">
                Tiered Bonuses For Every Growth Stage
              </h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-sm text-[#F5E6B3]">
              <Star className="h-4 w-4 text-[#D4AF37]" />
              Updated reward campaigns
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {BONUS_TIERS.map((tier) => (
              <article key={tier.tier} className="rounded-2xl border border-zinc-800 bg-black/30 p-5">
                <h3 className="text-lg font-bold text-[#D4AF37]">{tier.tier}</h3>
                <p className="mt-2 text-sm font-medium text-zinc-200">{tier.reward}</p>
                <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4AF37]" />
                      {perk}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-20 lg:px-10">
        <div className="mx-auto max-w-7xl rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 text-center md:p-9">
          <h2 className="text-2xl font-black text-white md:text-3xl">
            Start earning ecosystem bonuses today
          </h2>
          <p className="mt-3 text-sm text-zinc-400 md:text-base">
            Join Zuno, complete account setup, and activate rewards across trading, investing, and referrals.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-[#D4AF37]/45"
            >
              Login
            </Link>
            <Link
              href="/auth?signup=1"
              className="rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#E5BD45]"
            >
              Create Account
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
