"use client";

import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import { motion } from "framer-motion";

import { GoldRewardParticles } from "@/components/landing/GoldRewardParticles";
import { maxDailyRoiHeadline } from "@/lib/platformConfig/helpers";
import { usePlatformConfig } from "@/lib/platformConfig";

export function HeroFoundingPromoBadge({ className = "" }: { className?: string }) {
  const { config } = usePlatformConfig();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.25 }}
      className={`relative w-[19rem] max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border border-[#D4AF37]/22 bg-[rgba(8,15,28,0.8)] p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.36),0_0_24px_rgba(212,175,55,0.1)] backdrop-blur-xl sm:w-[20.5rem] sm:p-4 ${className}`}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#D4AF37]/12 blur-2xl" />
      <GoldRewardParticles count={5} seed={41} className="absolute inset-0 opacity-70" />

      <div className="relative">
        <p className="gold-gradient text-lg font-bold leading-[1.18] sm:text-xl">
          {maxDailyRoiHeadline(config.plans)}
        </p>

        <p className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400 sm:text-xs">
          <Clock className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden />
          <span>Promotion ends 1st of January</span>
        </p>

        <Link
          href="/investment-plans"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#D4AF37] transition hover:text-[#F5E6B3] sm:text-xs"
        >
          Upgrade to Elite Plan
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </motion.div>
  );
}
