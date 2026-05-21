"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  normalizeInvestmentPlan,
  displayPlanName,
  dailyCompoundLabel,
  formatDepositRangeDescription,
  type CanonicalInvestmentPlan,
} from "@/lib/investmentPlans";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

import {
  Check,
  ChevronDown,
  Crown,
  Gem,
  Rocket,
  Shield,
} from "lucide-react";

/** Visual ladder: basic utilitarian → premium gold (layout stays minimal). */
type PlanTheme = {
  cardBorder: string;
  cardHover: string;
  divider: string;
  iconWrap: string;
  iconClass: string;
  rangeClass: string;
  yieldLabelClass: string;
  rateClass: string;
  expandClass: string;
  checkClass: string;
  benefitTextClass: string;
  descriptionClass: string;
  secondaryCta: string;
  currentBadge: string;
  focusRingClass: string;
};

const plans = [
  {
    /** Stored on `investors.investment_plan` — matches compound-rate SQL. */
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
      cardBorder: "border-zinc-700/90",
      cardHover: "hover:border-zinc-500/50",
      divider: "border-t border-zinc-800/80",
      iconWrap: "border-zinc-600/70 bg-zinc-900/70",
      iconClass: "text-zinc-400",
      rangeClass: "text-zinc-400",
      yieldLabelClass: "text-zinc-500",
      rateClass: "text-zinc-200",
      expandClass: "text-zinc-500",
      checkClass: "text-zinc-500",
      benefitTextClass: "text-zinc-500",
      descriptionClass: "text-zinc-500",
      secondaryCta:
        "border-zinc-600/90 bg-zinc-900 text-zinc-100 hover:border-zinc-400/55",
      currentBadge:
        "border-zinc-500/35 bg-zinc-800/55 text-zinc-300",
      focusRingClass: "focus-visible:ring-zinc-500/45",
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
      cardBorder: "border-emerald-950/70",
      cardHover: "hover:border-emerald-600/45",
      divider: "border-t border-emerald-950/35",
      iconWrap: "border-emerald-800/35 bg-emerald-950/40",
      iconClass: "text-emerald-500",
      rangeClass: "text-emerald-400/95",
      yieldLabelClass: "text-emerald-600/85",
      rateClass: "text-emerald-300",
      expandClass: "text-emerald-500/90",
      checkClass: "text-emerald-600",
      benefitTextClass: "text-emerald-100/75",
      descriptionClass: "text-emerald-200/45",
      secondaryCta:
        "border-emerald-800/55 bg-emerald-950/35 text-emerald-50 hover:border-emerald-500/50",
      currentBadge:
        "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
      focusRingClass: "focus-visible:ring-emerald-500/45",
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
      cardBorder: "border-amber-950/55",
      cardHover: "hover:border-amber-600/50",
      divider: "border-t border-amber-950/30",
      iconWrap: "border-amber-800/40 bg-amber-950/35",
      iconClass: "text-amber-400",
      rangeClass: "text-amber-400",
      yieldLabelClass: "text-amber-600/80",
      rateClass: "text-amber-300",
      expandClass: "text-amber-500",
      checkClass: "text-amber-500",
      benefitTextClass: "text-amber-100/78",
      descriptionClass: "text-amber-200/48",
      secondaryCta:
        "border-amber-800/50 bg-amber-950/28 text-amber-50 hover:border-amber-500/55",
      currentBadge:
        "border-amber-500/38 bg-amber-500/12 text-amber-300",
      focusRingClass: "focus-visible:ring-amber-500/45",
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
      cardBorder: "border-yellow-500/45",
      cardHover: "hover:border-yellow-400/70",
      divider: "border-t border-yellow-900/30",
      iconWrap: "border-yellow-500/35 bg-yellow-500/14",
      iconClass: "text-yellow-400",
      rangeClass: "text-yellow-400",
      yieldLabelClass: "text-yellow-600/75",
      rateClass: "text-yellow-300",
      expandClass: "text-yellow-500",
      checkClass: "text-yellow-500",
      benefitTextClass: "text-yellow-100/88",
      descriptionClass: "text-yellow-100/48",
      secondaryCta: "",
      currentBadge:
        "border-yellow-500/45 bg-yellow-500/15 text-yellow-300",
      focusRingClass: "focus-visible:ring-yellow-500/55",
    },

    elite: true,
  },
];

const PLAN_ICONS = [Shield, Rocket, Gem, Crown] as const;

export default function InvestmentPlansPage() {
  const supabase = useSupabase();
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

  // Seed expansion based on viewport: desktop (≥ lg, 1024px) shows every plan
  // open by default so the full ladder is visible; phones/tablets keep cards
  // collapsed so the page stays scannable. Runs once on mount to avoid SSR
  // hydration mismatches and to not fight user toggles on subsequent resizes.
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

      // Auto-expand the investor's current plan so the CTA + status is in view
      // without forcing them to tap first.
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
    <div className="relative min-h-screen overflow-hidden text-white">
      <div className="relative z-10 mx-auto max-w-7xl p-5 md:p-7">
        <header className="mb-5 border-b border-zinc-800/80 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Investments
              </p>
              <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                Investment plans
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-600">
                Tiers show yield brackets for qualifying principal. Your active tier is assigned automatically from deposits (principal only)—you cannot pick a lower yield to bypass funding rules.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="text-xs font-semibold text-yellow-500 transition hover:text-yellow-400"
                >
                  ← Dashboard
                </Link>
              ) : (
                <Link
                  href="/"
                  className="text-xs font-semibold text-yellow-500 transition hover:text-yellow-400"
                >
                  ← Home
                </Link>
              )}
            </div>
          </div>
        </header>

        {planLoadError ? (
          <div
            className="mb-4 border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300"
            role="alert"
          >
            {planLoadError}
          </div>
        ) : null}

        {isLoggedIn && currentPlanSlug ? (
          <div className="mb-5 border border-zinc-800/80 bg-zinc-950/40 px-4 py-3 lg:rounded-lg">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Current plan
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              <span className="font-semibold text-yellow-500">
                {displayPlanName(currentPlanSlug)}
              </span>
              <span className="text-zinc-600">
                {" "}
                — assigned from approved principal (not from profits).
                {qualifyingPrincipal !== null ? (
                  <>
                    {" "}
                    Qualifying principal ≈ $
                    {qualifyingPrincipal.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                    .
                  </>
                ) : null}{" "}
                {tierManualOverride ? (
                  <span className="text-amber-400">
                    Support has locked manual tier override on your account.
                  </span>
                ) : (
                  <Link
                    href="/deposit"
                    className="font-medium text-yellow-500 hover:text-yellow-400"
                  >
                    Deposit or top up
                  </Link>
                )}{" "}
                to move brackets; withdrawing principal can move you down.
              </span>
            </p>
          </div>
        ) : null}

        <div className="mb-4 flex items-center justify-end">
          <button
            type="button"
            onClick={() =>
              setExpandedSlugs((prev) => {
                if (prev.size === plans.length) return new Set();
                return new Set(plans.map((p) => p.slug));
              })
            }
            className="text-xs font-semibold text-yellow-500 transition hover:text-yellow-400"
          >
            {expandedSlugs.size === plans.length ? "Collapse all" : "Expand all"}
          </button>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-4 xl:gap-4">
          {plans.map((plan, index) => {
            const Icon = PLAN_ICONS[index] ?? Shield;
            const isExpanded = expandedSlugs.has(plan.slug);
            const isCurrentPlan =
              isLoggedIn && currentPlanSlug === plan.slug;
            const summaryId = `plan-summary-${plan.slug}`;
            const detailsId = `plan-details-${plan.slug}`;

            return (
              <div
                key={plan.slug}
                className={`relative flex flex-col overflow-hidden border bg-zinc-950/40 transition lg:rounded-lg ${plan.theme.cardBorder} ${plan.theme.cardHover}`}
              >
                <button
                  type="button"
                  id={summaryId}
                  aria-expanded={isExpanded}
                  aria-controls={detailsId}
                  onClick={() => togglePlanExpansion(plan.slug)}
                  className={`relative z-10 w-full p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 sm:p-5 ${plan.theme.focusRingClass}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${plan.theme.iconWrap}`}
                    >
                      <Icon size={18} className={plan.theme.iconClass} aria-hidden />
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {isCurrentPlan ? (
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${plan.theme.currentBadge}`}
                        >
                          Your plan
                        </span>
                      ) : null}

                      {plan.elite ? (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-yellow-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                          <Crown size={10} aria-hidden />
                          VIP
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <h2 className="mb-0.5 text-base font-bold text-white sm:text-lg">
                    {plan.name}
                  </h2>

                  <p className={`mb-3 text-sm font-semibold ${plan.theme.rangeClass}`}>
                    {plan.range}
                  </p>

                  <div className="mb-1">
                    <p
                      className={`text-[11px] uppercase tracking-wide ${plan.theme.yieldLabelClass}`}
                    >
                      {plan.yield}
                    </p>
                    <p
                      className={`text-xl font-bold tabular-nums sm:text-2xl ${plan.theme.rateClass}`}
                    >
                      {plan.rate}
                    </p>
                  </div>

                  <div
                    className={`mt-3 flex items-center justify-between pt-3 text-xs font-semibold ${plan.theme.divider} ${plan.theme.expandClass}`}
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
                      <div
                        className={`px-4 pb-4 pt-3 sm:px-5 sm:pb-5 ${plan.theme.divider}`}
                      >
                        <p
                          className={`mb-4 text-xs leading-relaxed ${plan.theme.descriptionClass}`}
                        >
                          {plan.description}
                        </p>

                        <ul className="mb-4 space-y-2">
                          {plan.benefits.map((benefit) => (
                            <li
                              key={benefit}
                              className="flex items-start gap-2"
                            >
                              <Check
                                size={14}
                                className={`mt-0.5 shrink-0 ${plan.theme.checkClass}`}
                                aria-hidden
                              />
                              <span
                                className={`text-xs ${plan.theme.benefitTextClass}`}
                              >
                                {benefit}
                              </span>
                            </li>
                          ))}
                        </ul>

                        <Link
                          href={isLoggedIn ? "/deposit" : "/auth"}
                          className={`flex w-full items-center justify-center rounded-lg border py-2.5 text-xs font-bold transition ${
                            plan.elite
                              ? "border-transparent bg-yellow-500 text-black hover:bg-yellow-600"
                              : plan.theme.secondaryCta ||
                                "border-zinc-600 bg-zinc-900 text-zinc-100 hover:border-zinc-400"
                          }`}
                        >
                          {isLoggedIn ? "Go to deposit" : plan.button}
                        </Link>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="mt-10 border-t border-zinc-800/80 pt-6">
          <p className="mx-auto max-w-3xl text-center text-xs leading-relaxed text-zinc-600">
            Investment performance varies with market conditions and portfolio activity.
            Withdrawal rules and holding periods may apply by tier and allocation.
          </p>
        </div>
      </div>
    </div>
  );
}