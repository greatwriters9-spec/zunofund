"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
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

import { DASHBOARD_CARD, DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";
import { formatSignedUsdAmount, formatUsdAmount } from "@/lib/formatMoney";
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
import { formatTransactionDate } from "@/lib/transactionActivity";
import { useSupabase } from "@/lib/supabase";

function pct(current: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, (current / target) * 100));
}

function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-white/[0.06] ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#B8860B] via-[#D4AF37] to-[#F5E6B3] transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 sm:px-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: DASHBOARD_MUTED }}>
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tabular-nums text-white sm:text-lg">{value}</p>
    </div>
  );
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
      ? "border-[#00C076]/30 bg-[#00C076]/[0.04]"
      : variant === "eligible"
        ? "border-[#D4AF37]/35 bg-[#D4AF37]/[0.05]"
        : variant === "active"
          ? "border-white/[0.08] bg-white/[0.02]"
          : "border-white/[0.05] bg-white/[0.01]";

  const statusClass =
    variant === "activated"
      ? "bg-[#00C076]/10 text-[#00C076]"
      : variant === "eligible"
        ? "bg-[#D4AF37]/10 text-[#F5E6B3]"
        : variant === "active"
          ? "bg-[#D4AF37]/10 text-[#D4AF37]"
          : "bg-white/[0.05] text-zinc-500";

  const statusLabel =
    variant === "activated"
      ? "Activated"
      : variant === "eligible"
        ? "Eligible — awaiting admin"
        : variant === "active"
          ? "In progress"
          : "Upcoming";

  return (
    <motion.div
      layout
      initial={variant === "activated" ? { scale: 0.98, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      className={`rounded-xl border p-4 ${border}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-white">{item.title}</p>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
            {item.description}
          </p>
        </div>
        {variant === "activated" ? (
          <Sparkles className="h-5 w-5 shrink-0 text-[#00C076]" aria-hidden />
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {item.amountUsd != null ? (
          <span className="rounded-full bg-[#D4AF37]/15 px-2.5 py-1 font-semibold text-[#F5E6B3]">
            {formatUsdAmount(item.amountUsd)}
          </span>
        ) : null}
        {item.badge ? (
          <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-zinc-300">
            {item.badge}
          </span>
        ) : null}
        <span className={`rounded-full px-2.5 py-1 font-medium ${statusClass}`}>{statusLabel}</span>
      </div>

      {item.progress ? (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px]" style={{ color: DASHBOARD_MUTED }}>
            <span>{item.progress.label}</span>
            <span>{Math.round(pct(item.progress.current, item.progress.target))}%</span>
          </div>
          <ProgressBar value={pct(item.progress.current, item.progress.target)} />
        </div>
      ) : null}
    </motion.div>
  );
}

function PremiumSection({
  title,
  icon,
  action,
  children,
  className = "",
  id,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`${DASHBOARD_CARD} overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className="text-[#D4AF37]">{icon}</span>
          {title}
        </h2>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function RewardCatalogSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: React.ReactNode;
}) {
  return (
    <PremiumSection title={title} icon={icon}>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </PremiumSection>
  );
}

function RewardsLoadingShell() {
  return (
    <div className="relative min-h-full bg-[#05070D] text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,rgba(212,175,55,0.08)_0%,transparent_70%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-[1400px] px-4 py-14 text-center sm:px-6">
        <p className="text-sm" style={{ color: DASHBOARD_MUTED }}>
          Loading rewards…
        </p>
      </div>
    </div>
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
        claimed_reward_keys: Array.isArray(p.claimed_reward_keys) ? p.claimed_reward_keys : [],
        pending_reward_keys: Array.isArray(p.pending_reward_keys) ? p.pending_reward_keys : [],
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
    return <RewardsLoadingShell />;
  }

  if (error || !data) {
    return (
      <div className="relative min-h-full bg-[#05070D] text-white">
        <div className="relative mx-auto max-w-[1400px] px-4 py-14 sm:px-6">
          <div className={`${DASHBOARD_CARD} px-5 py-8 text-center text-sm text-red-300`}>
            {error ?? "Rewards unavailable"}
          </div>
        </div>
      </div>
    );
  }

  const loyalty = normalizeLoyaltyTier(data.loyalty_tier);
  const plan = normalizeInvestmentPlan(data.investment_plan);
  const tierPct = tierProgressPercent(plan, data.portfolio_usd);
  const loyaltyIdx = LOYALTY_TIER_ORDER.indexOf(loyalty);
  const merchantStatus = data.merchant_status?.toLowerCase() ?? null;

  const eliteBenefits = [
    "Merchant Dashboard access (after admin approval)",
    "Create P2P buy & sell offers",
    "Merchant analytics & transaction history",
    "Merchant revenue tracking",
    "Verified merchant application eligibility",
  ];

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

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
                Rewards & loyalty
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
                Your rewards center
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
                Track bonuses and milestones. When you qualify, rewards appear as eligible — an admin
                activates them before funds or badges are applied.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.06] px-4 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D4AF37]/15 text-[#D4AF37]">
                <Crown className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: DASHBOARD_MUTED }}>
                  Loyalty status
                </p>
                <p className="text-lg font-bold text-[#F5E6B3]">{LOYALTY_TIER_LABEL[loyalty]}</p>
              </div>
            </div>
          </div>
        </motion.header>

        {!data.program_enabled ? (
          <div className="rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-4 py-3 text-sm text-[#F5E6B3]">
            The rewards program is temporarily paused. Your existing rewards remain on record.
          </div>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${DASHBOARD_CARD} p-4 sm:p-5`}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
            <StatTile label="Portfolio" value={formatUsdAmount(data.portfolio_usd)} />
            <StatTile label="Investment tier" value={displayPlanName(plan)} />
            <StatTile label="Active referrals" value={String(data.active_referrals)} />
            <StatTile label="Activated" value={String(catalog.activated.length)} />
            <StatTile label="Awaiting admin" value={String(catalog.eligiblePending.length)} />
          </div>
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-2">
          <PremiumSection title="Tier progression" icon={<Target className="h-4 w-4" aria-hidden />}>
            <p className="text-sm" style={{ color: DASHBOARD_MUTED }}>
              {tierProgressLabel(plan)}
            </p>
            <ProgressBar value={tierPct} className="mt-3" />
            <p className="mt-2 text-xs" style={{ color: DASHBOARD_MUTED }}>
              {Math.round(tierPct)}% toward next investment tier (by qualifying principal)
            </p>
          </PremiumSection>

          <PremiumSection title="Holding duration" icon={<TrendingUp className="h-4 w-4" aria-hidden />}>
            <p className="text-lg font-semibold text-white">
              {data.holding_days} / {data.holding_days_required} days held
            </p>
            <p className="mt-1 text-sm" style={{ color: DASHBOARD_MUTED }}>
              Maintain an active investment balance. Counter resets if your balance reaches zero.
            </p>
            <ProgressBar
              value={pct(data.holding_days, data.holding_days_required)}
              className="mt-3"
            />
          </PremiumSection>
        </div>

        <PremiumSection title="Loyalty level progression" icon={<Award className="h-4 w-4" aria-hidden />}>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            {LOYALTY_TIER_ORDER.map((t, i) => (
              <span
                key={t}
                className={`min-w-0 rounded-full border px-2.5 py-2 text-center text-[11px] font-semibold uppercase tracking-wide sm:px-3 sm:text-xs ${
                  i <= loyaltyIdx
                    ? "border-[#D4AF37]/35 bg-[#D4AF37]/15 text-[#F5E6B3]"
                    : "border-white/[0.06] bg-white/[0.02] text-zinc-600"
                }`}
              >
                {LOYALTY_TIER_LABEL[t]}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs" style={{ color: DASHBOARD_MUTED }}>
            Based on deposits, portfolio value, holding duration, and referral performance.
          </p>
        </PremiumSection>

        {catalog.eligiblePending.length > 0 ? (
          <RewardCatalogSection
            title="Eligible — awaiting activation"
            icon={<Shield className="h-4 w-4" aria-hidden />}
          >
            {catalog.eligiblePending.map((r) => (
              <RewardCard key={r.key} item={r} variant="eligible" />
            ))}
          </RewardCatalogSection>
        ) : null}

        {catalog.activated.length > 0 ? (
          <RewardCatalogSection title="Activated rewards" icon={<Gift className="h-4 w-4" aria-hidden />}>
            {catalog.activated.map((r) => (
              <RewardCard key={r.key} item={r} variant="activated" />
            ))}
          </RewardCatalogSection>
        ) : null}

        {catalog.active.length > 0 ? (
          <RewardCatalogSection title="Active rewards" icon={<Sparkles className="h-4 w-4" aria-hidden />}>
            {catalog.active.map((r) => (
              <RewardCard key={r.key} item={r} variant="active" />
            ))}
          </RewardCatalogSection>
        ) : null}

        {catalog.upcoming.length > 0 ? (
          <RewardCatalogSection title="Upcoming rewards" icon={<Award className="h-4 w-4" aria-hidden />}>
            {catalog.upcoming.map((r) => (
              <RewardCard key={r.key} item={r} variant="upcoming" />
            ))}
          </RewardCatalogSection>
        ) : null}

        <PremiumSection title="Referral milestones" icon={<Users className="h-4 w-4" aria-hidden />}>
          <p className="text-sm" style={{ color: DASHBOARD_MUTED }}>
            Active referral = deposited funds and active investment balance.
          </p>
          <p className="mt-3 text-3xl font-bold tabular-nums text-white">{data.active_referrals}</p>
          <p className="text-xs" style={{ color: DASHBOARD_MUTED }}>
            active referrals
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#D4AF37] hover:text-[#F5E6B3]"
          >
            Share your referral link from the dashboard
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </PremiumSection>

        <PremiumSection
          id="merchant-eligibility"
          className="scroll-mt-24 border-[#D4AF37]/20"
          title="Merchant eligibility"
          icon={<Store className="h-4 w-4" aria-hidden />}
        >
          {data.merchant_eligible ? (
            <ul className="space-y-2 text-sm text-zinc-300">
              {eliteBenefits.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-[#D4AF37]">✓</span>
                  {b}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: DASHBOARD_MUTED }}>
              Reach Elite investment tier to unlock merchant program eligibility.
            </p>
          )}
          <p className="mt-4 text-sm" style={{ color: DASHBOARD_MUTED }}>
            Status:{" "}
            <span className="font-semibold text-white">
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
              className="mt-4 inline-flex rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 py-2.5 text-sm font-semibold text-[#F5E6B3] transition hover:bg-[#D4AF37]/15"
            >
              Open merchant dashboard
            </Link>
          ) : null}
        </PremiumSection>

        <PremiumSection
          title="Rewards history"
          icon={<Shield className="h-4 w-4" aria-hidden />}
          action={
            <Link
              href="/history?filter=reward"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#D4AF37] hover:text-[#F5E6B3]"
            >
              <History className="h-3.5 w-3.5" aria-hidden />
              View all
            </Link>
          }
        >
          {data.history.length === 0 ? (
            <p className="text-sm" style={{ color: DASHBOARD_MUTED }}>
              No rewards earned yet. Keep investing to unlock bonuses.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {data.history.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0 sm:items-center"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/10 text-[#D4AF37]">
                    <Gift className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{rewardTypeLabel(row.reward_type)}</p>
                    <p className="mt-0.5 truncate text-xs" style={{ color: DASHBOARD_MUTED }}>
                      {row.description ??
                        badgeLabel(row.badge_key) ??
                        formatTransactionDate(row.granted_at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {Number(row.amount) > 0 ? (
                      <p className="text-sm font-semibold tabular-nums text-[#00C076]">
                        {formatSignedUsdAmount(Number(row.amount))}
                      </p>
                    ) : row.badge_key ? (
                      <p className="text-sm text-zinc-300">{badgeLabel(row.badge_key)}</p>
                    ) : null}
                    <p className="text-[11px] font-medium capitalize text-[#D4AF37]">{row.status}</p>
                    <p className="text-[11px] tabular-nums" style={{ color: DASHBOARD_MUTED }}>
                      {formatTransactionDate(row.granted_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs" style={{ color: DASHBOARD_MUTED }}>
            Reinvestment bonus: 2% credited when you deposit while you have withdrawable profits
            available.
          </p>
        </PremiumSection>
      </div>
    </div>
  );
}
