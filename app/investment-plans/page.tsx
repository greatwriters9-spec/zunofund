"use client";

import Link from "next/link";
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion";
import {
  normalizeInvestmentPlan,
  displayPlanName,
  dailyCompoundLabel,
  formatDepositRangeDescription,
  type CanonicalInvestmentPlan,
  isTierDowngrade,
} from "@/lib/investmentPlans";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  Crown,
  Gem,
  Rocket,
  Shield,
} from "lucide-react";

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

    glow: "from-yellow-500/10 to-transparent",

    border: "border-yellow-500/20",
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

    glow: "from-yellow-500/20 to-transparent",

    border: "border-yellow-500/30",
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

    glow: "from-yellow-500/30 to-transparent",

    border: "border-yellow-500/40",
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

    glow: "from-yellow-400/40 to-transparent",

    border: "border-yellow-400/60",

    elite: true,
  },
];

const PLAN_ICONS = [Shield, Rocket, Gem, Crown] as const;

export default function InvestmentPlansPage() {
  const supabase = useSupabase();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPlanSlug, setCurrentPlanSlug] =
    useState<CanonicalInvestmentPlan | null>(null);
  const [planActionError, setPlanActionError] = useState<string | null>(null);
  const [planBusySlug, setPlanBusySlug] = useState<string | null>(null);
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
  async function loadSessionAndPlan() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setIsLoggedIn(!!user);
    setPlanActionError(null);

    if (!user?.id) {
      setCurrentPlanSlug(null);
      return;
    }

    const { data, error } = await supabase
      .from("investors")
      .select("investment_plan")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      setPlanActionError(formatSupabaseError(error));
      return;
    }

    const raw =
      typeof data?.investment_plan === "string" ? data.investment_plan : null;
    const normalized = normalizeInvestmentPlan(raw);
    setCurrentPlanSlug(normalized);

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
  const router = useRouter()
  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-5 py-10">
        {/* Header */}
        <div className="mb-14 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-yellow-500 mb-3 sm:text-4xl md:text-5xl md:mb-4">
              Investment Plans
            </h1>

            <p className="text-gray-400 max-w-2xl text-base leading-relaxed sm:text-lg">
              Choose the investment level that matches your
              financial goals and portfolio growth strategy.
            </p>
          </div>

          <div className="flex shrink-0 md:pt-2">
          {isLoggedIn ? (
  <Link
    href="/dashboard"
    className="flex items-center gap-2 bg-zinc-950/70 backdrop-blur-xl border border-zinc-800 hover:border-yellow-500 transition px-5 py-3 rounded-2xl"
  >
    <ArrowLeft size={18} />
    Dashboard
  </Link>
) : (
  <Link
    href="/"
    className="flex items-center gap-2 bg-zinc-950/70 backdrop-blur-xl border border-zinc-800 hover:border-yellow-500 transition px-5 py-3 rounded-2xl"
  >
    <ArrowLeft size={18} />
    Back Home
  </Link>
)}
          </div>
        </div>

        {planActionError ? (
          <div
            className="mb-10 rounded-2xl border border-red-500/50 bg-red-500/10 px-5 py-4 text-red-200 text-sm"
            role="alert"
          >
            {planActionError}
          </div>
        ) : null}

        {isLoggedIn && currentPlanSlug ? (
          <p className="mb-10 text-yellow-500/90 text-sm">
            Current plan:&nbsp;
            <span className="font-semibold text-yellow-400">
              {displayPlanName(currentPlanSlug)}
            </span>
            . Choosing a tier sets your bracket for automated daily compound.
          </p>
        ) : null}

        {/* Helper row for power users */}
        <div className="mb-5 flex items-center justify-end">
          <button
            type="button"
            onClick={() =>
              setExpandedSlugs((prev) => {
                if (prev.size === plans.length) return new Set();
                return new Set(plans.map((p) => p.slug));
              })
            }
            className="text-sm font-medium text-yellow-500 hover:text-yellow-400 transition"
          >
            {expandedSlugs.size === plans.length
              ? "Collapse all"
              : "Expand all"}
          </button>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
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
                className={`relative overflow-hidden rounded-3xl border ${plan.border} bg-zinc-950/70 backdrop-blur-xl flex flex-col transition duration-500 hover:border-yellow-500/70`}
              >
                {/* Ambient Glow */}
                <div
                  className={`absolute inset-0 bg-gradient-to-b ${plan.glow} opacity-60 pointer-events-none`}
                />

                {/* Compact summary — always visible, click to expand */}
                <button
                  type="button"
                  id={summaryId}
                  aria-expanded={isExpanded}
                  aria-controls={detailsId}
                  onClick={() => togglePlanExpansion(plan.slug)}
                  className="relative z-10 w-full text-left p-6 sm:p-7 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  {/* Top badges row */}
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-yellow-500/20 bg-yellow-500/10">
                      <Icon size={22} className="text-yellow-500" aria-hidden />
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {isCurrentPlan ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/40 bg-yellow-500/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-yellow-300">
                          Your plan
                        </span>
                      ) : null}

                      {plan.elite ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-black">
                          <Crown size={11} aria-hidden />
                          VIP
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Name */}
                  <h2 className="mb-1 text-xl font-bold sm:text-2xl">
                    {plan.name}
                  </h2>

                  {/* Range */}
                  <p className="mb-4 text-base font-semibold text-yellow-500 sm:text-lg">
                    {plan.range}
                  </p>

                  {/* Daily yield */}
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      {plan.yield}
                    </p>
                    <p className="text-2xl font-bold sm:text-3xl">
                      {plan.rate}
                    </p>
                  </div>

                  {/* Expand affordance */}
                  <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4 text-sm font-medium text-yellow-500/90">
                    <span>{isExpanded ? "Hide details" : "View details"}</span>
                    <ChevronDown
                      size={18}
                      aria-hidden
                      className={`transition-transform duration-300 ${
                        isExpanded ? "rotate-180" : "rotate-0"
                      }`}
                    />
                  </div>
                </button>

                {/* Expandable details */}
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
                      <div className="border-t border-white/5 px-6 pb-6 pt-5 sm:px-7 sm:pb-7">
                        {/* Description */}
                        <p className="mb-6 text-sm leading-relaxed text-gray-400">
                          {plan.description}
                        </p>

                        {/* Benefits */}
                        <ul className="mb-7 space-y-3">
                          {plan.benefits.map((benefit) => (
                            <li
                              key={benefit}
                              className="flex items-start gap-3"
                            >
                              <Check
                                size={16}
                                className="mt-0.5 shrink-0 text-yellow-500"
                                aria-hidden
                              />
                              <span className="text-sm text-gray-300">
                                {benefit}
                              </span>
                            </li>
                          ))}
                        </ul>

                        {/* CTA BUTTON */}
                        <button
                          type="button"
                          disabled={planBusySlug === plan.slug}
                          onClick={async (event) => {
                            event.stopPropagation();

                            const {
                              data: { user },
                            } = await supabase.auth.getUser();

                            if (!user) {
                              router.push("/auth");
                              return;
                            }

                            if (
                              typeof currentPlanSlug === "string" &&
                              isTierDowngrade(
                                currentPlanSlug,
                                plan.slug as CanonicalInvestmentPlan,
                              )
                            ) {
                              const proceed = confirm(
                                "This tier is lower than your current bracket. Proceed and use the lower daily compound rate?",
                              );
                              if (!proceed) return;
                            }

                            setPlanActionError(null);
                            setPlanBusySlug(plan.slug);

                            const { error } = await supabase
                              .from("investors")
                              .update({ investment_plan: plan.slug })
                              .eq("user_id", user.id);

                            setPlanBusySlug(null);

                            if (error) {
                              setPlanActionError(formatSupabaseError(error));
                              return;
                            }

                            setCurrentPlanSlug(
                              plan.slug as CanonicalInvestmentPlan,
                            );
                            router.push("/deposit");
                          }}
                          className={`flex w-full items-center justify-center rounded-2xl py-4 font-bold transition disabled:opacity-50 ${
                            plan.elite
                              ? "bg-yellow-500 text-black hover:bg-yellow-400"
                              : "bg-zinc-900 border border-zinc-800 hover:border-yellow-500 text-white"
                          }`}
                        >
                          {planBusySlug === plan.slug
                            ? "Updating…"
                            : plan.button}
                        </button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Bottom Disclaimer */}
        <div className="mt-14 text-center">
          <p className="text-gray-500 text-sm max-w-3xl mx-auto leading-relaxed">
            Investment performance varies based on market
            conditions and portfolio activity. Withdrawal
            conditions and investment durations may apply
            depending on selected investment level and
            portfolio allocation strategy.
          </p>
        </div>
      </div>
    </div>
  );
}