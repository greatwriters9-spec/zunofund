"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, Clock, Globe, ShieldCheck, Wallet } from "lucide-react";
import { SiBitcoin, SiEthereum, SiLitecoin, SiTether } from "react-icons/si";

import { HeroGoldParticles } from "@/components/landing/HeroGoldParticles";
import { HeroFoundingPromoBadge } from "@/components/landing/HeroFoundingPromoBadge";
import { LandingHeroShowcase } from "@/components/landing/LandingHeroShowcase";

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: "Secure & Trusted Transactions" },
  { icon: Wallet, label: "Low Fees High Value" },
  { icon: Globe, label: "Global Access Anywhere" },
  { icon: Clock, label: "24/7 Live Support" },
] as const;

const HERO_FLOAT_EASE = [0.45, 0, 0.55, 1] as const;

export function HeroSection() {
  return (
    <section id="home" className="relative overflow-hidden px-6 pb-10 pt-2 lg:px-12 lg:pb-12 lg:pt-4">
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

      <div className="relative z-10 mx-auto grid max-w-[1700px] items-center gap-4 max-lg:min-h-[560px] lg:grid-cols-[2fr_3fr] lg:gap-6 lg:min-h-[700px]">
        <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
          <motion.div
            className="absolute -left-1 top-1 sm:left-0 sm:top-2 lg:left-6 lg:top-4"
            animate={{ y: [0, -6, 0], rotate: [0, -3, 0] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: HERO_FLOAT_EASE, delay: 0.35 }}
          >
            <SiLitecoin className="h-6 w-6 text-[#B8C2CC] opacity-90 drop-shadow-[0_0_14px_rgba(184,194,204,0.45)] sm:h-7 sm:w-7 lg:h-9 lg:w-9" />
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85 }}
          className="flex flex-col justify-start lg:-mt-10"
        >
          <div className="relative h-0 w-full shrink-0" aria-hidden>
            <motion.div
              className="pointer-events-none absolute left-[17.5rem] top-[-1.25rem] z-20 sm:left-[21.5rem] sm:top-[-1rem] lg:left-[33rem] lg:top-[-1.5rem]"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: HERO_FLOAT_EASE }}
            >
              <SiBitcoin className="h-7 w-7 text-[#F7931A] drop-shadow-[0_0_18px_rgba(247,147,26,0.6)] sm:h-9 sm:w-9 lg:h-11 lg:w-11" />
            </motion.div>
            <motion.div
              className="pointer-events-none absolute left-[13.75rem] top-[3.75rem] z-20 sm:left-[17.5rem] sm:top-[4.5rem] lg:left-[22.5rem] lg:top-[5.75rem]"
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 3.8, repeat: Infinity, ease: HERO_FLOAT_EASE, delay: 0.65 }}
            >
              <SiTether className="h-6 w-6 text-[#26A17B] drop-shadow-[0_0_16px_rgba(38,161,123,0.55)] sm:h-8 sm:w-8 lg:h-10 lg:w-10" />
            </motion.div>
            <motion.div
              className="pointer-events-none absolute left-[14.5rem] top-[6.75rem] z-20 sm:left-[16.5rem] sm:top-[10.75rem] lg:left-[35.5rem] lg:top-[10.75rem]"
              animate={{ y: [0, -9, 0], rotate: [0, 2, 0] }}
              transition={{ duration: 4.6, repeat: Infinity, ease: HERO_FLOAT_EASE, delay: 1.1 }}
            >
              <SiEthereum className="h-16 w-6 text-[#627EEA] drop-shadow-[0_0_6px_rgba(98,126,234,0.18)] sm:h-12 sm:w-12 lg:h-[3.75rem] lg:w-[3.75rem]" />
            </motion.div>
          </div>
          <h1 className="flex max-w-2xl flex-col gap-3 font-extrabold tracking-[0.03em] sm:gap-4 lg:gap-5">
            <span className="block leading-none text-[2.25rem] text-white sm:text-[2.75rem] lg:text-[64px]">Dont Hold Crypto</span>
            <span className="gold-gradient block leading-none text-[3.75rem] sm:text-[5rem] lg:text-[96px]">Invest</span>
            <span className="block leading-none text-[2.25rem] text-white sm:text-[2.75rem] lg:text-[64px]">With Zuno</span>
          </h1>

          <p className="gold-gradient mt-3 text-xl font-semibold tracking-[0.04em] sm:text-2xl lg:text-[1.75rem]">
            The Future of P2P Digital Finance
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/auth?signup=1"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-7 py-3.5 text-base font-semibold text-black shadow-[0_0_24px_rgba(212,175,55,0.35)] transition hover:bg-[#E5BD45]"
            >
              Sign Up
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

          <div className="mt-14 grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      {/* Overlay only — out of document flow so hero layout stays unchanged */}
      <div className="pointer-events-none absolute bottom-[4.5rem] left-20 z-20 hidden lg:block xl:left-28">
        <div className="pointer-events-auto">
          <HeroFoundingPromoBadge className="mt-0 sm:mt-0" />
        </div>
      </div>
    </section>
  );
}
