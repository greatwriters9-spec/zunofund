"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ShieldCheck,
  Headset,
  ChevronRight,
  TrendingUp,
  Wallet,
  BarChart3,
  CheckCircle2,
  LineChart,
  Landmark,
  BadgeDollarSign,
} from "lucide-react";

export default function HomePage() {
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
    <main className="min-h-screen bg-black text-white overflow-hidden">

      {/* GLOBAL BACKGROUND */}
      <div className="fixed inset-0 pointer-events-none">

        <div className="absolute top-[-200px] right-[-100px] w-[600px] h-[600px] bg-yellow-500/10 blur-[180px]" />

        <div className="absolute bottom-[-250px] left-[-120px] w-[700px] h-[700px] bg-zinc-700/20 blur-[180px]" />

        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      {/* NAVBAR */}
      <header className="fixed top-0 left-0 w-full z-50 px-6 lg:px-10 pt-6">

        <div className="max-w-7xl mx-auto">

          <div className="backdrop-blur-2xl bg-white/[0.03] border border-white/10 rounded-3xl px-6 lg:px-8 py-5 flex items-center justify-between">

            <div className="flex items-center gap-3">

              <div className="w-11 h-11 rounded-2xl bg-yellow-500 flex items-center justify-center text-black font-black text-lg">
                A
              </div>

              <div>
                <h1 className="font-semibold tracking-wide text-lg">
                  ASKPAULFX
                </h1>

                <p className="text-xs text-gray-500">
                  Investment Management
                </p>
              </div>
            </div>

            <nav className="hidden lg:flex items-center gap-10 text-sm text-gray-300">

              <a href="#home" className="hover:text-yellow-500 transition">
                Home
              </a>

              <a href="#plans" className="hover:text-yellow-500 transition">
                Investment Plans
              </a>

              <a href="#how-it-works" className="hover:text-yellow-500 transition">
                How It Works
              </a>

              <Link
                href="/contact"
                className="hover:text-yellow-500 transition"
              >
                Support
              </Link>
            </nav>

            <div className="flex items-center gap-3">

              <Link
                href="/contact"
                className="hidden md:flex items-center gap-2 px-5 py-3 rounded-2xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 transition text-sm text-gray-300"
              >
                <Headset size={17} />
                Investor Support
              </Link>

              <Link
                href="/auth"
                className="hidden md:flex items-center gap-2 px-5 py-3 rounded-2xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 transition text-sm"
              >
                Login
              </Link>

              <Link
                href="/investment-plans"
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-yellow-500 hover:bg-yellow-400 transition text-black font-semibold text-sm"
              >
                Start Investing
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section
        id="home"
        className="relative pt-44 lg:pt-52 pb-32 px-6 lg:px-10"
      >

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="relative z-10"
          >

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-yellow-500/20 bg-yellow-500/10 text-yellow-500 text-sm mb-8">
              <ShieldCheck size={16} />
              Institutional Grade Investment Platform
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight max-w-3xl">

              Strategic Capital
              <span className="text-yellow-500"> Growth </span>
              Built For Modern Investors

            </h1>

            <p className="text-lg text-gray-400 leading-relaxed max-w-2xl mt-8">
              Access structured investment opportunities, disciplined portfolio
              management, and scalable capital allocation strategies designed
              to support long-term financial growth with confidence.
            </p>

            <div className="flex flex-wrap items-center gap-5 mt-12">

              <Link
                href="/investment-plans"
                className="group flex items-center gap-3 bg-yellow-500 hover:bg-yellow-400 transition px-8 py-5 rounded-2xl text-black font-semibold text-lg"
              >
                Explore Investment Plans

                <ArrowRight
                  size={20}
                  className="group-hover:translate-x-1 transition"
                />
              </Link>

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
                <h3 className="text-3xl font-bold text-yellow-500">
                  24/7
                </h3>

                <p className="text-gray-500 text-sm mt-2">
                  Investor Support
                </p>
              </div>

              <div>
                <h3 className="text-3xl font-bold text-yellow-500">
                  99%
                </h3>

                <p className="text-gray-500 text-sm mt-2">
                  Withdrawal Processing
                </p>
              </div>

              <div>
                <h3 className="text-3xl font-bold text-yellow-500">
                  Secure
                </h3>

                <p className="text-gray-500 text-sm mt-2">
                  Portfolio Tracking
                </p>
              </div>

              <div>
                <h3 className="text-3xl font-bold text-yellow-500">
                  Elite
                </h3>

                <p className="text-gray-500 text-sm mt-2">
                  Investment Plans
                </p>
              </div>
            </div>
          </motion.div>

          {/* RIGHT HERO CARD */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1 }}
            className="relative"
          >

            <div className="absolute inset-0 bg-yellow-500/10 blur-[120px]" />

            <div className="relative backdrop-blur-2xl bg-white/[0.03] border border-white/10 rounded-[40px] p-8 overflow-hidden">

              <div className="flex items-center justify-between mb-10">

                <div>
                  <p className="text-gray-500 text-sm mb-2">
                    Portfolio Performance
                  </p>

                  <h2 className="text-5xl font-black text-yellow-500">
                    +15%
                  </h2>
                </div>

                <div className="w-16 h-16 rounded-3xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                  <TrendingUp className="text-yellow-500 w-8 h-8" />
                </div>
              </div>

              {/* CHART */}
              <div className="relative h-[260px] rounded-3xl bg-zinc-950 border border-zinc-800 overflow-hidden">

                <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-transparent" />

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
                      <stop offset="0%" stopColor="#facc15" />
                      <stop offset="100%" stopColor="#eab308" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* PHONE MOCKUP */}
<div className="absolute right-0 -top-20 hidden xl:block z-40">

  {/* GOLD AMBIENT */}
  <div className="absolute inset-0 bg-yellow-500/10 blur-[120px] scale-150 pointer-events-none" />

  {/* PHONE FRAME */}
  <div className="relative w-[290px] h-[590px] rounded-[3.5rem] border border-zinc-800 bg-black shadow-[0_0_80px_rgba(234,179,8,0.15)] overflow-visible">

    {/* TOP GLOW */}
    <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/10 via-transparent to-transparent pointer-events-none" />

    {/* NOTCH */}
    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-32 h-7 bg-zinc-950 rounded-full border border-zinc-800 z-20" />

    {/* CONTENT */}
    <div className="relative z-10 flex flex-col h-full px-6 pt-16 pb-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">

        <div>
          <p className="text-yellow-500 text-sm font-medium">
            ASKPAULFX
          </p>

          <p className="text-zinc-500 text-xs mt-1">
            Live Investment Dashboard
          </p>
        </div>

        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />

      </div>

      {/* BALANCE */}
      <div className="mt-14 text-center">

        <p className="text-zinc-500 text-sm mb-3">
          Trading Account Balance
        </p>

        <h1 className="text-5xl font-black text-white tracking-tight">
          $207,500
        </h1>

        <p className="text-green-400 text-sm mt-3">
          +$7,500 profit added today
        </p>

      </div>

      {/* BUTTON */}
      <div className="mt-10 flex justify-center">

        <button className="px-8 py-4 rounded-full bg-white text-black font-bold hover:scale-105 transition duration-300">
          Withdraw Profits
        </button>

      </div>

      {/* NOTIFICATIONS */}
      <div className="mt-auto space-y-4">

        {/* NOTIFICATION 1 */}
        <div className="rounded-3xl bg-zinc-100 text-black px-5 py-4 shadow-2xl">

          <div className="flex items-start justify-between gap-4">

            <div className="flex gap-4">

              <div className="w-11 h-11 rounded-2xl bg-black flex items-center justify-center text-yellow-500 font-black text-lg">
                ✓
              </div>

              <div>

                <p className="font-semibold text-sm">
                  Reward Received
                </p>

                <p className="text-sm text-zinc-600 mt-1">
                  Congratulations! We've sent you $7,500
                </p>

              </div>

            </div>

            <span className="text-xs text-zinc-500">
              Now
            </span>

          </div>

        </div>

        {/* NOTIFICATION 2 */}
        <div className="rounded-3xl bg-zinc-900 border border-zinc-800 px-5 py-4">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-300">
                Withdrawal Approved
              </p>

              <p className="text-xs text-gray-500 mt-1">
                Funds sent successfully
              </p>

            </div>

            <p className="text-green-400 font-semibold">
              +$2,500
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
      </section>

      {/* INVESTMENT PLANS */}
      <section
        id="plans"
        className="relative py-32 px-6 lg:px-10"
      >

        <div className="max-w-7xl mx-auto">

          <div className="text-center max-w-3xl mx-auto mb-20">

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-yellow-500/20 bg-yellow-500/10 text-yellow-500 text-sm mb-8">
              Investment Plans
            </div>

            <h2 className="text-5xl lg:text-6xl font-black leading-tight">
              Structured Plans For
              <span className="text-yellow-500"> Every Investor</span>
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
                className="group relative rounded-[36px] border border-zinc-800 bg-zinc-950/80 backdrop-blur-xl p-8 hover:border-yellow-500/30 transition duration-500 flex flex-col"
              >

                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500 bg-gradient-to-b from-yellow-500/5 to-transparent rounded-[36px]" />

                <div className="relative z-10 flex flex-col h-full">

                  <div>
                    <p className="text-sm text-gray-500 mb-3">
                      {plan.range}
                    </p>

                    <h3 className="text-3xl font-bold mb-3">
                      {plan.name}
                    </h3>

                    <p className="text-yellow-500 font-semibold text-lg mb-6">
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
                        <CheckCircle2 className="w-4 h-4 text-yellow-500 shrink-0" />
                        {benefit}
                      </div>
                    ))}
                  </div>

                  <Link
                    href="/auth"
                    className="mt-10 flex items-center justify-center gap-3 bg-zinc-900 border border-zinc-700 hover:border-yellow-500 hover:bg-zinc-800 transition py-4 rounded-2xl font-semibold"
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

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-yellow-500/20 bg-yellow-500/10 text-yellow-500 text-sm mb-8">
              How It Works
            </div>

            <h2 className="text-5xl lg:text-6xl font-black leading-tight">
              A Structured
              <span className="text-yellow-500"> Investment Process</span>
            </h2>

            <p className="text-gray-400 text-lg leading-relaxed mt-8">
              Our investment system is designed to provide clarity,
              transparency, and disciplined portfolio management for every
              investor.
            </p>
          </div>

          <div className="grid lg:grid-cols-4 gap-8">

            <div className="rounded-[36px] border border-zinc-800 bg-zinc-950 p-8">
              <div className="w-16 h-16 rounded-3xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mb-8">
                <Wallet className="text-yellow-500 w-7 h-7" />
              </div>

              <h3 className="text-2xl font-bold mb-4">
                Create Account
              </h3>

              <p className="text-gray-400 leading-relaxed">
                Securely register and gain access to your personalized investor dashboard.
              </p>
            </div>

            <div className="rounded-[36px] border border-zinc-800 bg-zinc-950 p-8">
              <div className="w-16 h-16 rounded-3xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mb-8">
                <BadgeDollarSign className="text-yellow-500 w-7 h-7" />
              </div>

              <h3 className="text-2xl font-bold mb-4">
                Fund Portfolio
              </h3>

              <p className="text-gray-400 leading-relaxed">
                Deposit capital into your investment account and select your preferred plan.
              </p>
            </div>

            <div className="rounded-[36px] border border-zinc-800 bg-zinc-950 p-8">
              <div className="w-16 h-16 rounded-3xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mb-8">
                <LineChart className="text-yellow-500 w-7 h-7" />
              </div>

              <h3 className="text-2xl font-bold mb-4">
                Market Execution
              </h3>

              <p className="text-gray-400 leading-relaxed">
                Expert traders manage strategic market participation and portfolio positioning.
              </p>
            </div>

            <div className="rounded-[36px] border border-zinc-800 bg-zinc-950 p-8">
              <div className="w-16 h-16 rounded-3xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mb-8">
                <Landmark className="text-yellow-500 w-7 h-7" />
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
                <span className="text-yellow-500"> Structured Growth</span>
              </h2>

              <p className="text-gray-400 leading-relaxed mt-6 max-w-2xl">
                ASKPAULFX provides disciplined investment management,
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
                href="/auth"
                className="flex items-center gap-3 bg-yellow-500 hover:bg-yellow-400 transition px-8 py-5 rounded-2xl text-black font-semibold text-lg"
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
              © 2026 ASKPAULFX. All Rights Reserved.
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
