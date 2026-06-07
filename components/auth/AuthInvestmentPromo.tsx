"use client";

import Link from "next/link";
import { ArrowRight, Globe, Star, Users } from "lucide-react";

import { FoundingInvestorPromoCard } from "@/components/landing/FoundingInvestorPromoCard";
import {
  FOUNDING_POSITIONS_REMAINING,
  GROWTH_PROGRAM_BENEFITS,
} from "@/components/landing/growthProgramData";
import { GoldRewardParticles } from "@/components/landing/GoldRewardParticles";

type AuthInvestmentPromoProps = {
  variant?: "desktop" | "mobile";
};

export function AuthInvestmentPromo({ variant = "desktop" }: AuthInvestmentPromoProps) {
  const isMobile = variant === "mobile";

  return (
    <div
      className={`relative flex h-full flex-col ${
        isMobile ? "gap-6" : "justify-center gap-8 px-8 py-12 xl:px-14 xl:py-16"
      }`}
    >
      {!isMobile ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_70%_20%,rgba(212,175,55,0.14)_0%,transparent_55%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[#D4AF37]/10 blur-3xl"
            aria-hidden
          />
          <GoldRewardParticles count={12} seed={120} className="absolute inset-0" />
        </>
      ) : null}

      <div className={`relative ${isMobile ? "text-center" : ""}`}>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/[0.06] px-4 py-1.5">
          <Star className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">
            Founding Investor Access
          </span>
        </div>

        <h2
          className={`mt-5 font-semibold leading-[1.1] tracking-tight text-white ${
            isMobile ? "text-2xl" : "text-3xl xl:text-4xl"
          }`}
        >
          Don&apos;t Hold Crypto.{" "}
          <span className="gold-gradient block sm:inline">Invest With Zuno.</span>
        </h2>

        <p className={`mt-3 text-zinc-300 ${isMobile ? "text-sm" : "text-base xl:text-lg"}`}>
          The Future of P2P{" "}
          <span className="text-[#D4AF37]">Digital Finance.</span>
        </p>

        <p className={`mt-2 text-zinc-500 ${isMobile ? "text-xs" : "text-sm"}`}>
          Trusted by investors worldwide. Secure your position before public expansion.
        </p>

        <div
          className={`mt-5 inline-flex flex-col gap-1 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/[0.05] px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4 ${
            isMobile ? "w-full" : ""
          }`}
        >
          <div className="flex items-center justify-center gap-2.5 sm:justify-start">
            <Users className="h-5 w-5 text-[#D4AF37]" aria-hidden />
            <p className="text-sm font-semibold text-white">
              <span className="gold-gradient text-lg font-bold">{FOUNDING_POSITIONS_REMAINING}</span>{" "}
              Founding Positions Remaining
            </p>
          </div>
          <p className="text-center text-xs text-zinc-400 sm:border-l sm:border-[#D4AF37]/20 sm:pl-4 sm:text-left">
            Limited allocations. First come, first served.
          </p>
        </div>
      </div>

      <FoundingInvestorPromoCard className={isMobile ? "p-5 sm:p-6" : ""} />

      <div className={`relative grid gap-3 sm:grid-cols-2 ${isMobile ? "" : "max-w-2xl"}`}>
        {GROWTH_PROGRAM_BENEFITS.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-sm"
          >
            <Icon className="h-4 w-4 text-[#D4AF37]" aria-hidden />
            <p className="mt-2 text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{text}</p>
          </div>
        ))}
      </div>

      <div className={`relative flex flex-col gap-4 ${isMobile ? "items-center" : ""}`}>
        <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
          <Globe className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
          Trusted by Investors Worldwide
        </div>
        <Link
          href="/investment-plans"
          className="relative inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-6 py-3 text-sm font-bold text-black shadow-[0_0_28px_rgba(212,175,55,0.35)] transition hover:bg-[#E5BD45]"
        >
          <GoldRewardParticles count={6} seed={130} className="absolute -inset-2 overflow-visible" />
          <span className="relative">Secure Your Position</span>
          <ArrowRight size={16} className="relative" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
