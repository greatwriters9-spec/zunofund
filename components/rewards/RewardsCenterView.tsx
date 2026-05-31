"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Award,
  ChevronRight,
  Crown,
  Gift,
  History,
  Shield,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

import { formatUsdAmount } from "@/lib/formatMoney";
import { displayPlanName, normalizeInvestmentPlan } from "@/lib/investmentPlans";
import {
  badgeLabel,
  buildRewardCatalog,
  LOYALTY_TIER_LABEL,
  LOYALTY_TIER_ORDER,
  normalizeLoyaltyTier,
  rewardTypeLabel,
  tierProgressLabel,
  tierProgressPercent,
  type InvestorRewardsDashboard,
  type RewardCardDef,
} from "@/lib/rewards";
import { useSupabase } from "@/lib/supabase";

function pct(current: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, (current / target) * 100));
}

function RewardCard({
  item,
  variant,
}: {
  item: RewardCardDef;
  variant: "activated" | "eligible" | "active" | "upcoming";
}) {
  const border =
    variant === "activated"
      ? "border-emerald-500/35 bg-emerald-500/[0.06]"
      : variant === "eligible"
        ? "border-amber-500/40 bg-amber-500/[0.06]"
        : variant === "active"
          ? "border-yellow-500/25 bg-zinc-900/60"
          : "border-zinc-800/90 bg-zinc-950/40";

  return (
    <motion.div
      layout
      initial={variant === "activated" ? { scale: 0.96, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      className={`rounded-xl border p-4 ${border}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-zinc-100">{item.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">{item.description}</p>
        </div>
        {variant === "activated" ? (
          <Sparkles className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {item.amountUsd != null ? (
          <span className="rounded-md bg-yellow-500/15 px-2 py-1 font-semibold text-yellow-400">
            {formatUsdAmount(item.amountUsd)}
          </span>
        ) : null}
        {item.badge ? (
          <span className="rounded-md border border-zinc-700/80 px-2 py-1 text-zinc-300">{item.badge}</span>
        ) : null}
        {variant === "activated" ? (
          <span className="rounded-md bg-emerald-500/10 px-2 py-1 font-medium text-emerald-400">Activated</span>
        ) : variant === "eligible" ? (
          <span className="rounded-md bg-amber-500/10 px-2 py-1 font-medium text-amber-300">
            Eligible — awaiting admin
          </span>
        ) : variant === "active" ? (
          <span className="rounded-md bg-yellow-500/10 px-2 py-1 font-medium text-yellow-500/90">In progress</span>
        ) : (
          <span className="rounded-md bg-zinc-800/80 px-2 py-1 text-zinc-500">Upcoming</span>
        )}
      </div>
      {item.progress ? (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px] text-zinc-500">
            <span>{item.progress.label}</span>
            <span>{Math.round(pct(item.progress.current, item.progress.target))}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all"
              style={{ width: `${pct(item.progress.current, item.progress.target)}%` }}
            />
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-yellow-500/90">
        {icon}
        {title}
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function RewardsCenterView() {
  const supabase = useSupabase();
  const [data, setData] = useState<InvestorRewardsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: payload, error: rpcError } = await supabase.rpc("investor_rewards_dashboard");
    if (rpcError) {
      setError(rpcError.message);
      setData(null);
    } else if (payload && typeof payload === "object" && !("error" in (payload as object))) {
      const p = payload as InvestorRewardsDashboard;
      setData({
        ...p,
        claimed_reward_keys: Array.isArray(p.claimed_reward_keys)
          ? p.claimed_reward_keys
          : [],
        pending_reward_keys: Array.isArray(p.pending_reward_keys)
          ? p.pending_reward_keys
          : [],
        pending_rewards: Array.isArray(p.pending_rewards) ? p.pending_rewards : [],
        history: Array.isArray(p.history) ? p.history : [],
      });
    } else {
      setError("Unable to load rewards");
      setData(null);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading) return;
    if (typeof window === "undefined" || window.location.hash !== "#merchant-eligibility") {
      return;
    }
    const el = document.getElementById("merchant-eligibility");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading]);

  useEffect(() => {
    const onNotif = (ev: Event) => {
      const row = (ev as CustomEvent<Record<string, unknown>>).detail;
      const type = typeof row?.type === "string" ? row.type : "";
      if (
        type === "reward_eligible" ||
        type.startsWith("reward_") ||
        type === "tier_upgraded" ||
        type === "elite_status" ||
        type === "merchant_access_granted" ||
        type === "referral_milestone"
      ) {
        void load();
      }
    };
    window.addEventListener("tp:investor-notification", onNotif);
    return () => window.removeEventListener("tp:investor-notification", onNotif);
  }, [load]);

  const catalog = useMemo(
    () =>
      data
        ? buildRewardCatalog(data)
        : { activated: [], eligiblePending: [], active: [], upcoming: [] },
    [data],
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-500">
        Loading rewards…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-200">
        {error ?? "Rewards unavailable"}
      </div>
    );
  }

  const loyalty = normalizeLoyaltyTier(data.loyalty_tier);
  const plan = normalizeInvestmentPlan(data.investment_plan);
  const tierPct = tierProgressPercent(plan, data.portfolio_usd);
  const loyaltyIdx = LOYALTY_TIER_ORDER.indexOf(loyalty);

  const eliteBenefits = [
    "Merchant Dashboard access (after admin approval)",
    "Create P2P buy & sell offers",
    "Merchant analytics & transaction history",
    "Merchant revenue tracking",
    "Verified merchant application eligibility",
  ];

  const merchantStatus = data.merchant_status?.toLowerCase() ?? null;

  return (
    <div>
      <div className="rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/[0.08] via-zinc-950/80 to-zinc-950 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-500/80">
              Rewards & Loyalty Program
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Your Rewards Center
            </h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-400">
          Track every bonus and milestone here. When you qualify, rewards appear as eligible — an admin
          activates them before funds or badges are applied.
        </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-yellow-500/35 bg-black/40 px-4 py-3">
            <Crown className="h-6 w-6 text-yellow-500" aria-hidden />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Loyalty status</p>
              <p className="text-lg font-bold text-yellow-400">{LOYALTY_TIER_LABEL[loyalty]}</p>
            </div>
          </div>
        </div>

        {!data.program_enabled ? (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            The rewards program is temporarily paused. Your existing rewards remain on record.
          </p>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[
            { label: "Portfolio", value: formatUsdAmount(data.portfolio_usd) },
            { label: "Investment tier", value: displayPlanName(plan) },
            { label: "Active referrals", value: String(data.active_referrals) },
            { label: "Activated", value: String(catalog.activated.length) },
            { label: "Awaiting admin", value: String(catalog.eligiblePending.length) },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-zinc-800/80 bg-black/30 px-4 py-3"
            >
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">{s.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-zinc-800/90 bg-zinc-950/50 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">
          <Target className="h-4 w-4 text-yellow-500" aria-hidden />
          Tier progression
        </h2>
        <p className="mt-1 text-sm text-zinc-500">{tierProgressLabel(plan)}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400"
            style={{ width: `${tierPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-500">{Math.round(tierPct)}% toward next investment tier (by qualifying principal)</p>
      </section>

      <section className="mt-8 rounded-xl border border-zinc-800/90 bg-zinc-950/50 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">
          <TrendingUp className="h-4 w-4 text-yellow-500" aria-hidden />
          Holding duration
        </h2>
        <p className="mt-2 text-lg font-semibold text-zinc-100">
          Days Held: {data.holding_days} / {data.holding_days_required}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Maintain an active investment balance. Counter resets if your balance reaches zero.
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-yellow-500"
            style={{
              width: `${pct(data.holding_days, data.holding_days_required)}%`,
            }}
          />
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-zinc-800/90 bg-zinc-950/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">
          Loyalty level progression
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {LOYALTY_TIER_ORDER.map((t, i) => (
            <span
              key={t}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                i <= loyaltyIdx
                  ? "border-yellow-500/40 bg-yellow-500/15 text-yellow-300"
                  : "border-zinc-800 text-zinc-600"
              }`}
            >
              {LOYALTY_TIER_LABEL[t]}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Based on deposits, portfolio value, holding duration, and referral performance.
        </p>
      </section>

      {catalog.eligiblePending.length > 0 ? (
        <Section title="Eligible — awaiting activation" icon={<Shield className="h-4 w-4" aria-hidden />}>
          {catalog.eligiblePending.map((r) => (
            <RewardCard key={r.key} item={r} variant="eligible" />
          ))}
        </Section>
      ) : null}

      {catalog.activated.length > 0 ? (
        <Section title="Activated rewards" icon={<Gift className="h-4 w-4" aria-hidden />}>
          {catalog.activated.map((r) => (
            <RewardCard key={r.key} item={r} variant="activated" />
          ))}
        </Section>
      ) : null}

      {catalog.active.length > 0 ? (
        <Section title="Active rewards" icon={<Sparkles className="h-4 w-4" aria-hidden />}>
          {catalog.active.map((r) => (
            <RewardCard key={r.key} item={r} variant="active" />
          ))}
        </Section>
      ) : null}

      {catalog.upcoming.length > 0 ? (
        <Section title="Upcoming rewards" icon={<Award className="h-4 w-4" aria-hidden />}>
          {catalog.upcoming.map((r) => (
            <RewardCard key={r.key} item={r} variant="upcoming" />
          ))}
        </Section>
      ) : null}

      <section className="mt-8 rounded-xl border border-zinc-800/90 bg-zinc-950/50 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">
          <Users className="h-4 w-4 text-yellow-500" aria-hidden />
          Referral milestones
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Active referral = deposited funds and active investment balance.
        </p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-100">{data.active_referrals}</p>
        <p className="text-xs text-zinc-500">active referrals</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-yellow-500 hover:text-yellow-400"
        >
          Share your referral link from the dashboard
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </section>

      <section
        id="merchant-eligibility"
        className="mt-8 scroll-mt-24 rounded-xl border border-yellow-500/15 bg-yellow-500/[0.03] p-5"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-yellow-500/90">
          <Store className="h-4 w-4" aria-hidden />
          Merchant eligibility
        </h2>
        {data.merchant_eligible ? (
          <ul className="mt-4 space-y-2 text-sm text-zinc-300">
            {eliteBenefits.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="text-yellow-500">✓</span>
                {b}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">
            Reach Elite investment tier to unlock merchant program eligibility.
          </p>
        )}
        <p className="mt-4 text-sm text-zinc-400">
          Status:{" "}
          <span className="font-semibold text-zinc-200">
            {merchantStatus === "active"
              ? "Verified merchant — full dashboard access"
              : merchantStatus === "pending"
                ? "Application pending admin review"
                : catalog.eligiblePending.some((r) => r.key === "elite_merchant_benefits")
                  ? "Eligible — awaiting admin activation"
                  : data.merchant_eligible
                    ? "Eligible to apply — contact admin/support"
                    : "Not yet eligible"}
          </span>
        </p>
        {merchantStatus === "active" ? (
          <Link
            href="/merchant"
            className="mt-4 inline-flex rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/20"
          >
            Open merchant dashboard
          </Link>
        ) : null}
      </section>

      <section className="mt-8 rounded-xl border border-zinc-800/90 bg-zinc-950/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">
            <Shield className="h-4 w-4 text-yellow-500" aria-hidden />
            Rewards history
          </h2>
          <Link
            href="/history?filter=reward"
            className="inline-flex items-center gap-1 text-sm font-medium text-yellow-500 hover:text-yellow-400"
          >
            <History className="h-4 w-4" aria-hidden />
            View all in transaction history
          </Link>
        </div>
        {data.history.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No rewards earned yet. Keep investing to unlock bonuses.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-800/80">
            {data.history.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
                <div>
                  <p className="font-medium text-zinc-200">{rewardTypeLabel(row.reward_type)}</p>
                  <p className="text-xs text-zinc-500">
                    {row.description ??
                      badgeLabel(row.badge_key) ??
                      new Date(row.granted_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  {Number(row.amount) > 0 ? (
                    <p className="font-semibold tabular-nums text-yellow-400">
                      +{formatUsdAmount(Number(row.amount))}
                    </p>
                  ) : row.badge_key ? (
                    <p className="text-sm text-zinc-400">{badgeLabel(row.badge_key)}</p>
                  ) : null}
                  <p className="text-[10px] uppercase text-zinc-600">{row.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-zinc-600">
          Reinvestment bonus: 2% credited when you deposit while you have withdrawable profits available.
        </p>
      </section>
    </div>
  );
}
