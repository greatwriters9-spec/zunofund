"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { MarketingNavbar } from "@/components/navbar";
import { LiveMarketTickerView, useLiveMarketPrices } from "@/components/LiveMarketTicker";
import { HeadlineStats } from "@/components/HeadlineStats";
import {
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Wallet,
  CheckCircle2,
  LineChart,
  Landmark,
  BadgeDollarSign,
} from "lucide-react";

export default function HomePage() {
  const liveMarkets = useLiveMarketPrices();

  const plans = [
    {
      name: "Starter",
      range: "$200 - $500",
      roi: "Up to 7% Daily",
      description:
        "Perfect for investors beginning their portfolio growth journey with manageable capital exposure.",
      benefits: [
        "Beginner-friendly allocation",
        "Stable portfolio growth",
        "Low capital entry",
        "Portfolio monitoring",
      ],
      button: "Start Investing",
    },
    {
      name: "Growth",
      range: "$500 - $1,500",
      roi: "Up to 10% Daily",
      description:
        "Designed for investors seeking stronger capital expansion and increased earning potential.",
      benefits: [
        "Enhanced growth opportunities",
        "Priority monitoring",
        "Faster scaling",
        "Improved allocations",
      ],
      button: "Upgrade to Growth",
    },
    {
      name: "Pro",
      range: "$1,500 - $5,000",
      roi: "Up to 13% Daily",
      description:
        "Built for experienced investors focused on advanced portfolio participation.",
      benefits: [
        "Premium returns structure",
        "Advanced positioning",
        "Priority withdrawals",
        "Accelerated growth",
      ],
      button: "Go Pro",
    },
    {
      name: "Elite",
      range: "$5,000+",
      roi: "Up to 15% Daily",
      description:
        "Exclusive portfolio management for high-capital investors seeking elite opportunities.",
      benefits: [
        "VIP management",
        "Exclusive allocations",
        "Maximum portfolio access",
        "Highest return potential",
      ],
      button: "Join Elite",
    },
  ];

  return (
    <main className="relative min-h-screen text-white overflow-hidden">

      <MarketingNavbar />

      {/* HERO */}
      <section
        id="home"
        className="relative pt-20 lg:pt-28 pb-28 px-6 lg:px-12"
      >

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="relative z-10"
          >

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37] text-sm mb-8">
              <ShieldCheck size={16} />
              Trusted By 2,400+ Active Investors Worldwide
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight max-w-3xl">
              The World&rsquo;s Leading
              <span className="text-[#D4AF37]"> Fund Management </span>
              Firm
            </h1>

            <p className="text-lg text-gray-400 leading-relaxed max-w-2xl mt-8">
              Disciplined portfolio management, structured investment plans,
              and scalable capital allocation — engineered for serious
              investors and settled in real time across global markets.
            </p>

            <div className="mt-12 flex flex-col gap-8 lg:flex-row lg:flex-wrap lg:items-center lg:gap-5">

              <Link
                href="/investment-plans"
                className="group flex items-center gap-3 bg-gradient-to-r from-[#D4AF37] to-[#F5E6B3] transition px-8 py-5 rounded-2xl text-black font-semibold text-lg"
              >
                Explore Investment Plans

                <ArrowRight
                  size={20}
                  className="group-hover:translate-x-1 transition"
                />
              </Link>

              <LiveMarketTickerView
                {...liveMarkets}
                embedded
                headingId="live-markets-mobile"
                className="lg:hidden"
              />

              <Link
                href="/contact"
                className="flex items-center gap-3 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 transition px-8 py-5 rounded-2xl text-lg"
              >
                Speak With Support
                <ChevronRight size={20} />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-20">

              <div>
                <h3 className="text-3xl font-bold text-[#D4AF37]">
                  24/7
                </h3>

                <p className="text-gray-500 text-sm mt-2">
                  Investor Support
                </p>
              </div>

              <div>
                <h3 className="text-3xl font-bold text-[#D4AF37]">
                  99%
                </h3>

                <p className="text-gray-500 text-sm mt-2">
                  Withdrawal Processing
                </p>
              </div>

              <div>
                <h3 className="text-3xl font-bold text-[#D4AF37]">
                  Secure
                </h3>

                <p className="text-gray-500 text-sm mt-2">
                  Portfolio Tracking
                </p>
              </div>

              <div>
                <h3 className="text-3xl font-bold text-[#D4AF37]">
                  Elite
                </h3>

                <p className="text-gray-500 text-sm mt-2">
                  Investment Plans
                </p>
              </div>
            </div>
          </motion.div>

          {/* RIGHT HERO CARD - integrated 2-column dashboard panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1 }}
            className="relative"
          >

<div className="absolute inset-0 bg-[#D4AF37]/15 blur-[140px]" />

            <div className="relative backdrop-blur-2xl bg-white/[0.04] border border-white/10 rounded-[40px] p-5 sm:p-6 overflow-hidden">

              <div className="grid grid-cols-1 md:grid-cols-[0.75fr_1fr] gap-4 sm:gap-5">

                {/* LEFT: Portfolio Performance + Chart */}
                <div className="flex flex-col gap-5">

                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-500 text-sm mb-2">
                        Portfolio Performance
                      </p>
                      <h2 className="text-5xl font-black text-[#D4AF37]">
                        +15%
                      </h2>
                    </div>
                  </div>

                  <div className="relative flex-1 min-h-[260px] rounded-3xl bg-zinc-950 border border-zinc-800 overflow-hidden">

                    <div className="absolute inset-0 bg-gradient-to-b from-[#D4AF37]/10 to-transparent" />

                    <div
                      className="absolute inset-0 opacity-[0.05]"
                      style={{
                        backgroundImage:
                          "linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)",
                        backgroundSize: "50px 50px",
                      }}
                    />

                    <svg
                      viewBox="0 0 600 260"
                      preserveAspectRatio="none"
                      className="absolute inset-0 w-full h-full"
                      fill="none"
                    >
                      <path
                        d="M0 220 C80 190 120 200 180 170 C240 140 280 150 340 110 C400 70 470 90 600 20"
                        stroke="url(#goldLine)"
                        strokeWidth="5"
                        strokeLinecap="round"
                      />

                      <defs>
                        <linearGradient
                          id="goldLine"
                          x1="0"
                          y1="0"
                          x2="600"
                          y2="0"
                        >
                          <stop offset="0%" stopColor="#F5E6B3" />
                          <stop offset="100%" stopColor="#D4AF37" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>

                {/* RIGHT: Dashboard panel */}
                <div className="relative rounded-3xl bg-black/60 border border-white/10 p-4 sm:p-5 flex flex-col overflow-hidden">

                  <div className="absolute inset-0 bg-gradient-to-b from-[#D4AF37]/5 via-transparent to-transparent pointer-events-none" />

                  <div className="relative z-10 flex items-center justify-between">
                    <p className="text-zinc-400 text-xs">
                      Live Investment Dashboard
                    </p>
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.7)] animate-pulse" />
                  </div>

                  <div className="relative z-10 mt-8 text-center">
                    <p className="text-zinc-500 text-xs sm:text-sm mb-2">
                      Trading Account Balance
                    </p>
                    <h3 className="text-3xl sm:text-4xl xl:text-5xl font-black text-white tracking-tight whitespace-nowrap">
                      $207,500
                    </h3>
                    <p className="text-green-400 text-xs sm:text-sm mt-3">
                      +$7,500 profit added today
                    </p>
                  </div>

                  <div className="relative z-10 mt-6 flex justify-center">
                    <button
                      type="button"
                      className="px-7 py-3 rounded-full bg-white text-black font-semibold hover:scale-[1.02] transition duration-300"
                    >
                      Withdraw Profits
                    </button>
                  </div>

                  <div className="relative z-10 mt-auto pt-6">
                    <div className="rounded-2xl bg-zinc-100 text-black px-3 py-3 shadow-2xl">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-[13px] truncate">
                              Reward Received
                            </p>
                            <span className="text-[10px] text-zinc-500 shrink-0">
                              Now
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-600 mt-1 leading-snug">
                            Congratulations! We&apos;ve sent you $7,500
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <LiveMarketTickerView
          {...liveMarkets}
          stripe
          headingId="live-markets-desktop"
          className="hidden lg:block"
        />
      </section>

      {/* HEADLINE STATS */}
      <HeadlineStats />

      {/* INVESTMENT PLANS */}
      <section
        id="plans"
        className="relative py-32 px-6 lg:px-10"
      >

        <div className="max-w-7xl mx-auto">

          <div className="text-center max-w-3xl mx-auto mb-20">

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37] text-sm mb-8">
              Investment Plans
            </div>

            <h2 className="text-5xl lg:text-6xl font-black leading-tight">
              Structured Plans For
              <span className="text-[#D4AF37]"> Every Investor</span>
            </h2>

            <p className="text-gray-400 text-lg leading-relaxed mt-8">
              Select an investment tier aligned with your portfolio objectives,
              capital strategy, and long-term financial goals.
            </p>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-8">

            {plans.map((plan, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group relative rounded-[36px] border border-zinc-800 bg-zinc-950/80 backdrop-blur-xl p-8 hover:border-[#D4AF37]/30 transition duration-500 flex flex-col"
              >

                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500 bg-gradient-to-b from-[#D4AF37]/5 to-transparent rounded-[36px]" />

                <div className="relative z-10 flex flex-col h-full">

                  <div>
                    <p className="text-sm text-gray-500 mb-3">
                      {plan.range}
                    </p>

                    <h3 className="text-3xl font-bold mb-3">
                      {plan.name}
                    </h3>

                    <p className="text-[#D4AF37] font-semibold text-lg mb-6">
                      {plan.roi}
                    </p>

                    <p className="text-gray-400 leading-relaxed mb-8">
                      {plan.description}
                    </p>
                  </div>

                  <div className="space-y-4 flex-1">
                    {plan.benefits.map((benefit, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 text-sm text-gray-300"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
                        {benefit}
                      </div>
                    ))}
                  </div>

                  <Link
                    href="/auth?signup=1"
                    className="mt-10 flex items-center justify-center gap-3 bg-zinc-900 border border-zinc-700 hover:border-[#D4AF37] hover:bg-zinc-800 transition py-4 rounded-2xl font-semibold"
                  >
                    {plan.button}
                    <ArrowRight size={18} />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        className="relative py-32 px-6 lg:px-10"
      >

        <div className="max-w-7xl mx-auto">

          <div className="text-center max-w-3xl mx-auto mb-24">

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37] text-sm mb-8">
              How It Works
            </div>

            <h2 className="text-5xl lg:text-6xl font-black leading-tight">
              A Structured
              <span className="text-[#D4AF37]"> Investment Process</span>
            </h2>

            <p className="text-gray-400 text-lg leading-relaxed mt-8">
              Our investment system is designed to provide clarity,
              transparency, and disciplined portfolio management for every
              investor.
            </p>
          </div>

          <div className="grid lg:grid-cols-4 gap-8">

            <div className="rounded-[36px] border border-zinc-800 bg-zinc-950 p-8">
              <div className="w-16 h-16 rounded-3xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center mb-8">
                <Wallet className="text-[#D4AF37] w-7 h-7" />
              </div>

              <h3 className="text-2xl font-bold mb-4">
                Create Account
              </h3>

              <p className="text-gray-400 leading-relaxed">
                Securely register and gain access to your personalized investor dashboard.
              </p>
            </div>

            <div className="rounded-[36px] border border-zinc-800 bg-zinc-950 p-8">
              <div className="w-16 h-16 rounded-3xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center mb-8">
                <BadgeDollarSign className="text-[#D4AF37] w-7 h-7" />
              </div>

              <h3 className="text-2xl font-bold mb-4">
                Fund Portfolio
              </h3>

              <p className="text-gray-400 leading-relaxed">
                Deposit capital into your investment account and select your preferred plan.
              </p>
            </div>

            <div className="rounded-[36px] border border-zinc-800 bg-zinc-950 p-8">
              <div className="w-16 h-16 rounded-3xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center mb-8">
                <LineChart className="text-[#D4AF37] w-7 h-7" />
              </div>

              <h3 className="text-2xl font-bold mb-4">
                Market Execution
              </h3>

              <p className="text-gray-400 leading-relaxed">
                Expert traders manage strategic market participation and portfolio positioning.
              </p>
            </div>

            <div className="rounded-[36px] border border-zinc-800 bg-zinc-950 p-8">
              <div className="w-16 h-16 rounded-3xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center mb-8">
                <Landmark className="text-[#D4AF37] w-7 h-7" />
              </div>

              <h3 className="text-2xl font-bold mb-4">
                Profit Distribution
              </h3>

              <p className="text-gray-400 leading-relaxed">
                Monitor portfolio growth, receive profits, and request secure withdrawals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative border-t border-zinc-900 py-20 px-6 lg:px-10">

        <div className="max-w-7xl mx-auto">

          <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">

            <div>
              <h2 className="text-4xl font-black leading-tight max-w-2xl">
                Built For Investors Seeking
                <span className="text-[#D4AF37]"> Structured Growth</span>
              </h2>

              <p className="text-gray-400 leading-relaxed mt-6 max-w-2xl">
                Zuno provides disciplined investment management,
                professional market execution, and scalable portfolio growth
                solutions for modern investors.
              </p>
            </div>

            <div className="flex flex-wrap lg:justify-end gap-5">

              <Link
                href="/contact"
                className="flex items-center gap-3 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 transition px-8 py-5 rounded-2xl text-lg"
              >
                Investor Support
              </Link>

              <Link
                href="/auth?signup=1"
                className="flex items-center gap-3 bg-[#D4AF37] hover:bg-[#E5BD45] transition px-8 py-5 rounded-2xl text-black font-semibold text-lg"
              >
                Create Account
                <ArrowRight size={20} />
              </Link>
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">

            <div>
              <p className="text-sm text-gray-500 leading-relaxed max-w-3xl">
                Risk Disclaimer: Investment and trading activities involve risk.
                Market conditions may impact portfolio performance. Past
                performance does not guarantee future results. Investors are
                advised to understand market risks and invest responsibly.
              </p>
            </div>

            <div className="text-sm text-gray-600">
              © 2026 Zuno. All Rights Reserved.
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
