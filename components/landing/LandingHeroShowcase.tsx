"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { BadgeCheck, ShieldCheck, Store, TrendingUp } from "lucide-react";

import { WorldMapVisual } from "@/components/landing/WorldMapVisual";

export function LandingHeroShowcase() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.05 }}
      className="relative mx-auto h-full min-h-[860px] w-full max-w-none"
    >
      {/* Shared ambient environment — transparent base, no pure black */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 35% 40%, rgba(15,35,70,0.35) 0%, rgba(8,15,28,0.18) 45%, transparent 75%)",
          }}
        />

        <div
          aria-hidden
          className="absolute bottom-[6%] left-1/2 z-[15] h-[720px] w-[920px] -translate-x-1/2 rounded-full blur-[140px]"
          style={{ backgroundColor: "rgba(212,175,55,0.10)" }}
        />

        <div
          aria-hidden
          className="absolute -right-28 -top-28 z-[15] h-[580px] w-[580px] rounded-full blur-[180px]"
          style={{ backgroundColor: "rgba(56,189,248,0.08)" }}
        />

        <WorldMapVisual className="absolute inset-0 h-full w-full opacity-[0.22]" showLogo />

        <div className="absolute inset-0 bg-gradient-to-t from-[#060B14]/35 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#05080F]/25" />
      </div>

      {/* Laptop mock — sits under phone (z-30) */}
      <div className="absolute left-[15%] top-[10%] z-30 hidden w-[78%] lg:block">
        <div className="overflow-hidden rounded-[22px] border border-[rgba(56,189,248,0.08)] bg-[rgba(8,15,28,0.52)] p-2 pt-2.5 shadow-[0_40px_120px_rgba(0,0,0,0.55),0_0_64px_rgba(56,189,248,0.06),inset_0_1px_0_rgba(56,189,248,0.1)] backdrop-blur-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/hero-p2p-marketplace-crop.png"
            alt="Zuno marketplace dashboard"
            className="block h-auto w-full max-h-[460px] object-contain object-top"
            decoding="async"
          />
        </div>
      </div>

      {/* Phone — in front of laptop */}
      <div className="absolute left-[-2%] top-[18%] z-40 w-full max-w-[300px]">
        <div className="rounded-[32px] border-[5px] border-zinc-600/70 bg-[rgba(12,20,36,0.85)] p-1.5 shadow-[0_40px_100px_rgba(0,0,0,0.59),0_0_48px_rgba(56,189,248,0.05)]">
          <div className="relative overflow-hidden rounded-[24px] bg-[rgba(8,15,28,0.88)]">
            <div
              className="absolute left-1/2 top-1.5 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-[#060B14]"
              aria-hidden
            />
            <div className="relative aspect-[9/19.5] w-full">
              <Image
                src="/landing/hero-phone-p2p.png"
                alt="Zuno P2P marketplace on mobile"
                fill
                className="object-cover object-top"
                sizes="320px"
                priority
              />
            </div>
          </div>
        </div>
      </div>

      {/* Floating cards */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute right-5 top-10 z-50 w-[220px] rounded-3xl border border-[#D4AF37]/35 bg-[rgba(8,15,28,0.72)] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.39),0_0_55px_rgba(212,175,55,0.24)] backdrop-blur-2xl"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Market Overview</p>
        <div className="mt-2.5 space-y-1.5 text-sm tabular-nums">
          <div className="flex justify-between text-emerald-400">
            <span>BTC</span>
            <span>$68,315</span>
          </div>
          <div className="flex justify-between text-zinc-300">
            <span>ETH</span>
            <span>$3,510</span>
          </div>
          <div className="flex justify-between text-zinc-300">
            <span>USDT</span>
            <span>$1.00</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute right-6 top-[36%] z-50 hidden w-[220px] rounded-3xl border border-zinc-500/70 bg-[rgba(10,16,25,0.74)] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.39),0_0_62px_rgba(212,175,55,0.24)] backdrop-blur-2xl md:block"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Portfolio</p>
        <p className="mt-1 text-xl font-black tabular-nums text-white">$207,500</p>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400">
          <TrendingUp className="h-3.5 w-3.5" aria-hidden />
          +4.2% today
        </p>
      </motion.div>

      <motion.div
        animate={{ y: [0, 7, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-12 left-[28%] z-50 rounded-3xl border border-zinc-700/80 bg-[rgba(10,16,25,0.78)] p-4 text-sm shadow-[0_18px_60px_rgba(0,0,0,0.39),0_0_55px_rgba(212,175,55,0.2)] backdrop-blur-2xl"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]">Global network</p>
        <ul className="mt-2 space-y-1 text-zinc-200">
          <li className="font-semibold">2,400+ Active Traders</li>
          <li>380+ Verified Merchants</li>
          <li>38 Countries</li>
        </ul>
      </motion.div>

      <div className="absolute bottom-8 right-8 z-50 w-[220px] rounded-3xl border border-emerald-500/30 bg-[rgba(7,18,14,0.72)] p-4 text-sm shadow-[0_18px_60px_rgba(0,0,0,0.39),0_0_48px_rgba(16,185,129,0.14)] backdrop-blur-2xl">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-emerald-400" aria-hidden />
          <span className="font-semibold text-emerald-300">Verified merchant</span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-zinc-400">
          <Store className="h-3 w-3 text-[#D4AF37]" />
          P2P listings live
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-zinc-400">
          <ShieldCheck className="h-3 w-3 text-emerald-400" />
          Escrow protected
        </p>
      </div>
    </motion.div>
  );
}
