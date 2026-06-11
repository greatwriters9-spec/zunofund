"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Crown,
  Gem,
  Rocket,
  Shield,
  Sparkles,
} from "lucide-react";

import { DASHBOARD_CARD, DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";
import {
  normalizeInvestmentPlan,
  displayPlanName,
  dailyCompoundLabel,
  formatDepositRangeDescription,
  type CanonicalInvestmentPlan,
} from "@/lib/investmentPlans";
import { formatUsdAmount } from "@/lib/formatMoney";
import { usePlatformConfig } from "@/lib/platformConfig";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

type PlanTheme = {
  ambient: string;
  card: string;
  cardActive: string;
  iconWrap: string;
  iconClass: string;
  rangePill: string;
  yieldLabelClass: string;
  rateClass: string;
  expandClass: string;
  checkClass: string;
  benefitTextClass: string;
  descriptionClass: string;
  cta: string;
  currentBadge: string;
  focusRingClass: string;
};

const plans = [
  {
    slug: "Starter" satisfies CanonicalInvestmentPlan,
    name: "Starter Level",
    range: formatDepositRangeDescription("Starter"),
    yield: "Projected Daily Yield",
    rate: dailyCompoundLabel("Starter"),
    description:
      "Perfect for new investors looking to begin building consistent market exposure with manageable capital risk.",
    benefits: [
      "Entry-level investment access",
      "Stable growth potential",
      "Beginner-friendly exposure",
      "Portfolio monitoring support",
    ],
    button: "Start Investing",
    theme: {
      ambient: "bg-zinc-500/20",
      card: "border-white/[0.08] bg-[linear-gradient(165deg,rgba(32,36,48,0.92)_0%,rgba(10,14,22,0.98)_55%,rgba(6,9,15,1)_100%)] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.85)]",
      cardActive:
        "ring-1 ring-white/15 shadow-[0_28px_70px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]",
      iconWrap: "border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
      iconClass: "text-zinc-300",
      rangePill: "border-zinc-600/40 bg-zinc-800/50 text-zinc-300",
      yieldLabelClass: "text-zinc-500",
      rateClass: "text-zinc-100",
      expandClass: "text-zinc-500",
      checkClass: "text-[#D4AF37]/70",
      benefitTextClass: "text-zinc-400",
      descriptionClass: "text-zinc-500",
      cta: "border-white/12 bg-white/[0.06] text-zinc-100 hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/10",
      currentBadge: "border-zinc-500/30 bg-zinc-800/60 text-zinc-200",
      focusRingClass: "focus-visible:ring-[#D4AF37]/35",
    },
  },
  {
    slug: "Growth" satisfies CanonicalInvestmentPlan,
    name: "Growth Level",
    range: formatDepositRangeDescription("Growth"),
    yield: "Projected Daily Yield",
    rate: dailyCompoundLabel("Growth"),
    description:
      "Designed for investors seeking stronger growth opportunities with enhanced portfolio scaling.",
    benefits: [
      "Increased growth potential",
      "Fast portfolio expansion",
      "Priority account monitoring",
      "Enhanced trading allocation",
    ],
    button: "Upgrade to Growth",
    theme: {
      ambient: "bg-[#D4AF37]/14",
      card: "border-[#D4AF37]/18 bg-[linear-gradient(165deg,rgba(42,38,24,0.55)_0%,rgba(14,16,24,0.98)_48%,rgba(6,9,15,1)_100%)] shadow-[0_24px_60px_-28px_rgba(212,175,55,0.18)]",
      cardActive:
        "ring-1 ring-[#D4AF37]/25 shadow-[0_28px_70px_-24px_rgba(212,175,55,0.22),inset_0_1px_0_rgba(212,175,55,0.12)]",
      iconWrap: "border-[#D4AF37]/25 bg-[#D4AF37]/10",
      iconClass: "text-[#E8C96A]",
      rangePill: "border-[#D4AF37]/30 bg-[#D4AF37]/12 text-[#F5E6B3]",
      yieldLabelClass: "text-[#D4AF37]/65",
      rateClass: "text-[#F5E6B3]",
      expandClass: "text-[#D4AF37]/80",
      checkClass: "text-[#D4AF37]",
      benefitTextClass: "text-zinc-300",
      descriptionClass: "text-zinc-500",
      cta: "border-[#D4AF37]/35 bg-[#D4AF37]/12 text-[#F5E6B3] hover:border-[#D4AF37]/55 hover:bg-[#D4AF37]/20",
      currentBadge: "border-[#D4AF37]/35 bg-[#D4AF37]/12 text-[#F5E6B3]",
      focusRingClass: "focus-visible:ring-[#D4AF37]/45",
    },
  },
  {
    slug: "Pro" satisfies CanonicalInvestmentPlan,
    name: "Pro Level",
    range: formatDepositRangeDescription("Pro"),
    yield: "Projected Daily Yield",
    rate: dailyCompoundLabel("Pro"),
    description:
      "Built for experienced investors focused on maximizing capital performance through advanced market participation.",
    benefits: [
      "Premium growth structure",
      "Advanced market positioning",
      "Accelerated capital scaling",
      "Priority withdrawal processing",
    ],
    button: "Go Pro",
    theme: {
      ambient: "bg-[#D4AF37]/22",
      card: "border-[#D4AF37]/28 bg-[linear-gradient(165deg,rgba(58,48,22,0.65)_0%,rgba(16,14,22,0.98)_45%,rgba(6,9,15,1)_100%)] shadow-[0_28px_64px_-26px_rgba(212,175,55,0.28)]",
      cardActive:
        "ring-1 ring-[#D4AF37]/35 shadow-[0_32px_80px_-28px_rgba(212,175,55,0.35),inset_0_1px_0_rgba(212,175,55,0.18)]",
      iconWrap: "border-[#D4AF37]/35 bg-[#D4AF37]/16",
      iconClass: "text-[#F5E6B3]",
      rangePill: "border-[#D4AF37]/40 bg-[#D4AF37]/16 text-[#F5E6B3]",
      yieldLabelClass: "text-[#D4AF37]/75",
      rateClass: "text-[#FFE9A8]",
      expandClass: "text-[#D4AF37]",
      checkClass: "text-[#D4AF37]",
      benefitTextClass: "text-zinc-200",
      descriptionClass: "text-zinc-500",
      cta: "border-[#D4AF37]/45 bg-[#D4AF37]/18 text-white hover:bg-[#D4AF37]/28",
      currentBadge: "border-[#D4AF37]/45 bg-[#D4AF37]/16 text-[#F5E6B3]",
      focusRingClass: "focus-visible:ring-[#D4AF37]/50",
    },
  },
  {
    slug: "Elite" satisfies CanonicalInvestmentPlan,
    name: "Elite Level",
    range: formatDepositRangeDescription("Elite"),
    yield: "Projected Daily Yield",
    rate: dailyCompoundLabel("Elite"),
    description:
      "Exclusive access for high-capital investors seeking premium portfolio management and advanced investment opportunities.",
    benefits: [
      "Highest growth potential",
      "VIP account management",
      "Exclusive investment access",
      "Maximum portfolio allocation",
    ],
    button: "Join Elite",
    theme: {
      ambient: "bg-[#D4AF37]/32",
      card: "border-[#D4AF37]/40 bg-[linear-gradient(165deg,rgba(72,58,18,0.75)_0%,rgba(22,18,12,0.98)_40%,rgba(8,10,16,1)_100%)] shadow-[0_32px_72px_-24px_rgba(212,175,55,0.42)]",
      cardActive:
        "ring-1 ring-[#D4AF37]/50 shadow-[0_36px_90px_-28px_rgba(212,175,55,0.5),inset_0_1px_0_rgba(255,236,180,0.2)]",
      iconWrap: "border-[#D4AF37]/50 bg-[#D4AF37]/22 shadow-[0_0_24px_-6px_rgba(212,175,55,0.45)]",
      iconClass: "text-[#FFE9A8]",
      rangePill: "border-[#D4AF37]/50 bg-[#D4AF37]/20 text-white",
      yieldLabelClass: "text-[#D4AF37]",
      rateClass: "gold-gradient text-2xl sm:text-3xl",
      expandClass: "text-[#F5E6B3]",
      checkClass: "text-[#FFE9A8]",
      benefitTextClass: "text-zinc-100",
      descriptionClass: "text-zinc-400",
      cta: "border-transparent bg-[#D4AF37] text-black shadow-[0_12px_32px_-8px_rgba(212,175,55,0.65)] hover:bg-[#E5BD45]",
      currentBadge: "border-[#D4AF37]/55 bg-[#D4AF37]/20 text-[#FFE9A8]",
      focusRingClass: "focus-visible:ring-[#D4AF37]/60",
    },
    elite: true,
  },
] as const;

const PLAN_ICONS = [Shield, Rocket, Gem, Crown] as const;

export default function InvestmentPlansPage() {
  const supabase = useSupabase();
  const { config } = usePlatformConfig();
  const displayPlans = useMemo(
    () =>
      plans.map((plan) => ({
        ...plan,
        range: formatDepositRangeDescription(plan.slug, config.plans),
        rate: dailyCompoundLabel(plan.slug, config.plans),
      })),
    [config.plans],
  );
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPlanSlug, setCurrentPlanSlug] =
    useState<CanonicalInvestmentPlan | null>(null);
  const [qualifyingPrincipal, setQualifyingPrincipal] = useState<number | null>(
    null,
  );
  const [tierManualOverride, setTierManualOverride] = useState(false);
  const [planLoadError, setPlanLoadError] = useState<string | null>(null);
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(
    () => new Set(),
  );

  const togglePlanExpansion = (slug: string) => {
    setExpandedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    if (isDesktop) {
      setExpandedSlugs(new Set(plans.map((p) => p.slug)));
    }
  }, []);

  useEffect(() => {
    async function loadSessionAndPlan() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setIsLoggedIn(!!user);
      setPlanLoadError(null);

      if (!user?.id) {
        setCurrentPlanSlug(null);
        setQualifyingPrincipal(null);
        setTierManualOverride(false);
        return;
      }

      const { data, error } = await supabase
        .from("investors")
        .select(
          "investment_plan, tier_qualifying_principal, tier_manual_override",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setPlanLoadError(formatSupabaseError(error));
        return;
      }

      const raw =
        typeof data?.investment_plan === "string" ? data.investment_plan : null;
      const normalized = normalizeInvestmentPlan(raw);
      setCurrentPlanSlug(normalized);

      const tqp = (data as { tier_qualifying_principal?: unknown })
        ?.tier_qualifying_principal;
      setQualifyingPrincipal(
        tqp !== null && tqp !== undefined && Number.isFinite(Number(tqp))
          ? Number(tqp)
          : null,
      );
      setTierManualOverride(
        Boolean((data as { tier_manual_override?: unknown })?.tier_manual_override),
      );

      if (normalized) {
        setExpandedSlugs((prev) => {
          if (prev.has(normalized)) return prev;
          const next = new Set(prev);
          next.add(normalized);
          return next;
        });
      }
    }

    loadSessionAndPlan();
  }, [supabase]);

  return (
    <div className="relative min-h-full bg-[#05070D] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,rgba(212,175,55,0.08)_0%,transparent_70%)]"
      />

      <div className="relative z-10 mx-auto max-w-[1400px] space-y-5 px-4 py-5 pb-6 sm:space-y-6 sm:px-6 sm:pb-8 lg:py-8">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Link
            href={isLoggedIn ? "/dashboard" : "/"}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-[#D4AF37]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {isLoggedIn ? "Dashboard" : "Home"}
          </Link>

          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
              <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              ZunoFund
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
              Investment <span className="text-[#D4AF37]">plans</span>
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
              Tiers reflect yield brackets for qualifying principal. Your active tier is assigned
              automatically from approved deposits (principal only)—you cannot select a lower yield to
              bypass funding rules.
            </p>
          </div>
        </motion.header>

        {planLoadError ? (
          <div
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            role="alert"
          >
            {planLoadError}
          </div>
        ) : null}

        {isLoggedIn && currentPlanSlug ? (
          <div
            className={`${DASHBOARD_CARD} border-[#D4AF37]/20 bg-[linear-gradient(135deg,rgba(212,175,55,0.08)_0%,rgba(12,17,28,0.85)_50%)] p-5`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
              Your current plan
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              <span className="text-lg font-semibold text-[#F5E6B3]">
                {displayPlanName(currentPlanSlug)}
              </span>
              <span style={{ color: DASHBOARD_MUTED }}>
                {" "}
                — assigned from approved principal, not from profits.
                {qualifyingPrincipal !== null ? (
                  <>
                    {" "}
                    Qualifying principal ≈ {formatUsdAmount(qualifyingPrincipal)}.
                  </>
                ) : null}{" "}
                {tierManualOverride ? (
                  <span className="text-amber-300/90">
                    Support has locked manual tier override on your account.
                  </span>
                ) : (
                  <Link
                    href="/deposit"
                    className="font-semibold text-[#D4AF37] underline-offset-2 hover:text-[#F5E6B3] hover:underline"
                  >
                    Deposit or top up
                  </Link>
                )}{" "}
                to move brackets; withdrawing principal can move you down.
              </span>
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() =>
              setExpandedSlugs((prev) => {
                if (prev.size === plans.length) return new Set();
                return new Set(plans.map((p) => p.slug));
              })
            }
            className="rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/15 px-4 py-2 text-xs font-semibold text-[#F5E6B3] shadow-[0_0_20px_rgba(212,175,55,0.12)] transition hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/20"
          >
            {expandedSlugs.size === plans.length ? "Collapse all" : "Expand all"}
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-4 xl:gap-6"
        >
          {displayPlans.map((plan, index) => {
            const Icon = PLAN_ICONS[index] ?? Shield;
            const isExpanded = expandedSlugs.has(plan.slug);
            const isCurrentPlan =
              isLoggedIn && currentPlanSlug === plan.slug;
            const summaryId = `plan-summary-${plan.slug}`;
            const detailsId = `plan-details-${plan.slug}`;

            return (
              <article
                key={plan.slug}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border backdrop-blur-md transition duration-300 hover:-translate-y-0.5 ${plan.theme.card} ${isCurrentPlan ? plan.theme.cardActive : ""}`}
              >
                <div
                  aria-hidden
                  className={`pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-3xl ${plan.theme.ambient}`}
                />

                <button
                  type="button"
                  id={summaryId}
                  aria-expanded={isExpanded}
                  aria-controls={detailsId}
                  onClick={() => togglePlanExpansion(plan.slug)}
                  className={`relative z-10 w-full p-5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070D] sm:p-6 ${plan.theme.focusRingClass}`}
                >
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${plan.theme.iconWrap}`}
                    >
                      <Icon size={20} className={plan.theme.iconClass} aria-hidden />
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {isCurrentPlan ? (
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${plan.theme.currentBadge}`}
                        >
                          Your plan
                        </span>
                      ) : null}

                      {plan.slug === "Elite" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#D4AF37] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black shadow-[0_4px_14px_-4px_rgba(212,175,55,0.55)]">
                          <Crown size={10} aria-hidden />
                          VIP
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <h2 className="text-lg font-bold text-white sm:text-xl">{plan.name}</h2>

                  <p
                    className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${plan.theme.rangePill}`}
                  >
                    {plan.range}
                  </p>

                  <div className="mt-5 rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3">
                    <p
                      className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${plan.theme.yieldLabelClass}`}
                    >
                      {plan.yield}
                    </p>
                    <p
                      className={`mt-1 text-2xl font-black tabular-nums sm:text-3xl ${plan.theme.rateClass}`}
                    >
                      {plan.rate}
                    </p>
                  </div>

                  <div
                    className={`mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs font-semibold ${plan.theme.expandClass}`}
                  >
                    <span>{isExpanded ? "Hide details" : "View details"}</span>
                    <ChevronDown
                      size={16}
                      aria-hidden
                      className={`transition-transform duration-300 ${
                        isExpanded ? "rotate-180" : "rotate-0"
                      }`}
                    />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded ? (
                    <motion.div
                      key="details"
                      id={detailsId}
                      role="region"
                      aria-labelledby={summaryId}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        height: { duration: 0.3, ease: "easeInOut" },
                        opacity: { duration: 0.2, ease: "easeOut" },
                      }}
                      className="relative z-10 overflow-hidden"
                    >
                      <div className="border-t border-white/[0.06] px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                        <p
                          className={`mb-4 text-xs leading-relaxed ${plan.theme.descriptionClass}`}
                        >
                          {plan.description}
                        </p>

                        <ul className="mb-5 space-y-2.5">
                          {plan.benefits.map((benefit) => (
                            <li
                              key={benefit}
                              className="flex items-start gap-2.5"
                            >
                              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/12">
                                <Check
                                  size={12}
                                  className={plan.theme.checkClass}
                                  aria-hidden
                                />
                              </span>
                              <span
                                className={`text-xs leading-relaxed ${plan.theme.benefitTextClass}`}
                              >
                                {benefit}
                              </span>
                            </li>
                          ))}
                        </ul>

                        <Link
                          href={isLoggedIn ? "/deposit" : "/auth"}
                          className={`flex w-full items-center justify-center rounded-2xl border py-3 text-xs font-bold transition ${plan.theme.cta}`}
                        >
                          {isLoggedIn ? "Go to deposit" : plan.button}
                        </Link>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </article>
            );
          })}
        </motion.div>

        <div className={`${DASHBOARD_CARD} px-5 py-6 text-center`}>
          <p className="mx-auto max-w-3xl text-xs leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
            Investment performance varies with market conditions and portfolio activity. Withdrawal
            rules and holding periods may apply by tier and allocation.
          </p>
        </div>
      </div>
    </div>
  );
}
