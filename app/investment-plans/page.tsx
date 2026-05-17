"use client";

import Link from "next/link";
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
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

export default function InvestmentPlansPage() {
  const supabase = useSupabase();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPlanSlug, setCurrentPlanSlug] =
    useState<CanonicalInvestmentPlan | null>(null);
  const [planActionError, setPlanActionError] = useState<string | null>(null);
  const [planBusySlug, setPlanBusySlug] = useState<string | null>(null);

useEffect(() => {
  loadSessionAndPlan()
}, [])

async function loadSessionAndPlan() {

  const { data: { user } } =
    await supabase.auth.getUser()

  setIsLoggedIn(!!user)
  setPlanActionError(null)

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

  const raw = typeof data?.investment_plan === "string" ? data.investment_plan : null;
  setCurrentPlanSlug(normalizeInvestmentPlan(raw));

}
  const router = useRouter()
  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-5 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-14">
          <div>
            <h1 className="text-5xl font-bold text-yellow-500 mb-4">
              Investment Plans
            </h1>

            <p className="text-gray-400 max-w-2xl text-lg leading-relaxed">
              Choose the investment level that matches your
              financial goals and portfolio growth strategy.
            </p>
          </div>

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

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {plans.map((plan, index) => (
            <div
              key={plan.slug}
              className={`relative overflow-hidden rounded-3xl border ${plan.border} bg-zinc-950/70 backdrop-blur-xl p-7 flex flex-col justify-between transition duration-500 hover:-translate-y-1 hover:border-yellow-500/70`}
            >
              {/* Ambient Glow */}
              <div
                className={`absolute inset-0 bg-gradient-to-b ${plan.glow} opacity-60 pointer-events-none`}
              />

              {/* Elite Badge */}
              {plan.elite && (
                <div className="absolute top-5 right-5 bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <Crown size={12} />
                  VIP ACCESS
                </div>
              )}

              {isLoggedIn && currentPlanSlug === plan.slug ? (
                <div
                  className={`absolute top-5 ${
                    plan.elite ? "left-5" : "right-5"
                  } bg-yellow-500/20 text-yellow-400 text-xs font-semibold px-3 py-1 rounded-full border border-yellow-500/40`}
                >
                  Your plan
                </div>
              ) : null}

              <div className="relative z-10">
                {/* Icon */}
                <div className="mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                    {index === 0 && (
                      <Shield
                        className="text-yellow-500"
                        size={26}
                      />
                    )}

                    {index === 1 && (
                      <Rocket
                        className="text-yellow-500"
                        size={26}
                      />
                    )}

                    {index === 2 && (
                      <Gem
                        className="text-yellow-500"
                        size={26}
                      />
                    )}

                    {index === 3 && (
                      <Crown
                        className="text-yellow-500"
                        size={26}
                      />
                    )}
                  </div>
                </div>

                {/* Name */}
                <h2 className="text-2xl font-bold mb-2">
                  {plan.name}
                </h2>

                {/* Deposit Range */}
                <p className="text-yellow-500 text-lg font-semibold mb-5">
                  {plan.range}
                </p>

                {/* Yield */}
                <div className="mb-6">
                  <p className="text-gray-500 text-sm mb-1">
                    {plan.yield}
                  </p>

                  <p className="text-3xl font-bold">
                    {plan.rate}
                  </p>
                </div>

                {/* Description */}
                <p className="text-gray-400 leading-relaxed mb-7 text-sm">
                  {plan.description}
                </p>

                {/* Benefits */}
                <div className="space-y-4 mb-8">
                  {plan.benefits.map(
                    (benefit, benefitIndex) => (
                      <div
                        key={benefitIndex}
                        className="flex items-start gap-3"
                      >
                        <div className="mt-1">
                          <Check
                            size={16}
                            className="text-yellow-500"
                          />
                        </div>

                        <p className="text-gray-300 text-sm">
                          {benefit}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>

             {/* CTA BUTTON */}
<button
  disabled={planBusySlug === plan.slug}
  onClick={async () => {

    const { data: { user } } =
      await supabase.auth.getUser()

    if (!user) {
      router.push("/auth")
      return
    }

    if (
      typeof currentPlanSlug === "string" &&
      isTierDowngrade(currentPlanSlug, plan.slug as CanonicalInvestmentPlan)
    ) {
      const proceed = confirm(
        "This tier is lower than your current bracket. Proceed and use the lower daily compound rate?",
      );
      if (!proceed) return;
    }

    setPlanActionError(null)
    setPlanBusySlug(plan.slug)

    const { error } = await supabase
      .from("investors")
      .update({ investment_plan: plan.slug })
      .eq("user_id", user.id)

    setPlanBusySlug(null)

    if (error) {
      setPlanActionError(formatSupabaseError(error))
      return
    }

    setCurrentPlanSlug(plan.slug as CanonicalInvestmentPlan)
    router.push("/deposit")
  }}
  className={`relative z-10 mt-auto w-full py-4 rounded-2xl font-bold transition flex items-center justify-center disabled:opacity-50 ${
    plan.elite
      ? "bg-yellow-500 text-black hover:bg-yellow-400"
      : "bg-zinc-900 border border-zinc-800 hover:border-yellow-500 text-white"
  }`}
>
  {planBusySlug === plan.slug ? "Updating…" : plan.button}
</button>
            </div>
          ))}
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