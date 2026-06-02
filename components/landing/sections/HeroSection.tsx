"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, Clock, Globe, ShieldCheck, Wallet } from "lucide-react";

import { HeroGoldParticles } from "@/components/landing/HeroGoldParticles";
import { LandingHeroShowcase } from "@/components/landing/LandingHeroShowcase";

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: "Secure & Trusted Transactions" },
  { icon: Wallet, label: "Low Fees High Value" },
  { icon: Globe, label: "Global Access Anywhere" },
  { icon: Clock, label: "24/7 Live Support" },
] as const;

export function HeroSection() {
  return (
    <section id="home" className="relative overflow-hidden px-6 pb-10 pt-12 lg:px-12 lg:pb-12 lg:pt-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          background: [
            "radial-gradient(circle at 78% 44%, rgba(15,35,70,0.22) 0%, rgba(8,15,28,0.1) 48%, transparent 72%)",
            "radial-gradient(circle at 70% 40%, rgba(212,175,55,0.08), transparent 40%)",
            "radial-gradient(circle at 20% 30%, rgba(56,189,248,0.05), transparent 40%)",
            "linear-gradient(90deg, #05080F 0%, #060B14 38%, #07121c 62%, #08101f 82%, #060B14 100%)",
            "linear-gradient(180deg, #05080F 0%, #060B14 100%)",
          ].join(", "),
        }}
      />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#060B14]/90 via-[#060B14]/40 to-transparent" />
      <div className="pointer-events-none absolute bottom-[-180px] left-1/2 h-[420px] w-[1400px] -translate-x-1/2 rounded-full bg-gradient-to-t from-[#D4AF37]/35 via-[#D4AF37]/10 to-transparent blur-[140px]" />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.25) 100%)",
        }}
      />

      <HeroGoldParticles />

      <div className="relative z-10 mx-auto grid max-w-[1700px] items-center gap-6 max-lg:min-h-[640px] lg:grid-cols-[2fr_3fr] lg:gap-6 lg:min-h-[860px]">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85 }}
          className="flex flex-col justify-center"
        >
          <h1 className="flex max-w-2xl flex-col gap-3 font-extrabold tracking-[0.03em] sm:gap-4 lg:gap-5">
            <span className="block leading-none text-[2.5rem] text-white sm:text-[3rem] lg:text-[72px]">The Future of</span>
            <span className="gold-gradient block leading-none text-[4.25rem] uppercase sm:text-[5.5rem] lg:text-[110px]">P2P</span>
            <span className="block leading-none text-[2.5rem] text-white sm:text-[3rem] lg:text-[72px]">Digital Finance</span>
          </h1>

          <p className="mt-5 text-lg font-medium tracking-wide text-[#D4AF37] sm:text-xl">
            Buy, Sell. Invest. Earn
          </p>

          <div className="mt-4 inline-flex w-fit items-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-sm font-medium text-[#F7E3A0] backdrop-blur-md">
            Trusted by Investors, Traders & Merchants Worldwide
          </div>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-400">
            A global marketplace connecting investors, traders, and verified merchants through one secure ecosystem.
          </p>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-zinc-500">
            Trade directly, access investment opportunities, and participate in the next generation of digital finance.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/auth?signup=1"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-7 py-3.5 text-base font-semibold text-black shadow-[0_0_24px_rgba(212,175,55,0.35)] transition hover:bg-[#E5BD45]"
            >
              Create Account
              <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/auth"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-transparent px-7 py-3.5 text-base font-semibold text-white transition hover:border-[#D4AF37]/50 hover:bg-white/[0.03]"
            >
              Explore Marketplace
              <ChevronRight size={18} />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TRUST_ITEMS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 text-sm text-zinc-300">
                <Icon className="h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <LandingHeroShowcase />
      </div>
    </section>
  );
}
