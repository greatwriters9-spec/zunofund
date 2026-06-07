"use client";

import Link from "next/link";
import { ArrowRight, Star, Users } from "lucide-react";

import { FoundingInvestorPromoCard } from "@/components/landing/FoundingInvestorPromoCard";
import { FOUNDING_POSITIONS_REMAINING } from "@/components/landing/growthProgramData";
import { GoldRewardParticles } from "@/components/landing/GoldRewardParticles";

type GrowthProgramSectionProps = {
  sectionId?: string;
};

export function GrowthProgramSection({ sectionId }: GrowthProgramSectionProps) {
  const isMobileInvest = sectionId === "mobile-invest";

  return (
    <section
      id={sectionId}
      className={
        isMobileInvest
          ? "relative scroll-mt-24 border-t border-[#D4AF37]/12 bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(212,175,55,0.06)_0%,transparent_50%)] px-4 py-8 lg:border-t-0 lg:px-10 lg:py-28 lg:scroll-mt-0"
          : "relative px-6 py-20 lg:px-10 lg:py-28"
      }
    >
      <div className="mx-auto max-w-7xl">
        <header className="mx-auto max-w-4xl text-center">
          <div
            className={`inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/[0.06] px-4 py-1.5 ${
              isMobileInvest ? "mb-4 lg:mb-6" : "mb-6"
            }`}
          >
            <Star className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">
              Founding Investor Access
            </span>
          </div>

          <h2
            className={`font-semibold leading-[1.08] tracking-tight text-white ${
              isMobileInvest
                ? "text-[1.85rem] sm:text-4xl md:text-5xl lg:text-[3.25rem]"
                : "text-[2rem] sm:text-4xl md:text-5xl lg:text-[3.25rem]"
            }`}
          >
            Become One of Zuno&apos;s{" "}
            <span className="gold-gradient">First Investors</span>
          </h2>

          <p
            className={`mx-auto max-w-2xl font-medium leading-relaxed text-zinc-300 ${
              isMobileInvest
                ? "mt-4 text-base sm:text-lg lg:mt-5"
                : "mt-5 text-lg sm:text-xl"
            }`}
          >
            Secure priority access to Zuno&apos;s growth ecosystem before public expansion.
          </p>

          <div
            className={`mx-auto mt-6 inline-flex max-w-xl flex-col items-center gap-1 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/[0.05] px-5 py-3.5 sm:flex-row sm:gap-4 ${
              isMobileInvest ? "lg:mt-8" : "lg:mt-8"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Users className="h-5 w-5 text-[#D4AF37]" aria-hidden />
              <p className="text-sm font-semibold text-white sm:text-base">
                <span className="gold-gradient text-lg font-bold sm:text-xl">
                  {FOUNDING_POSITIONS_REMAINING}
                </span>{" "}
                Founding Positions Remaining
              </p>
            </div>
            <p className="text-xs text-zinc-400 sm:border-l sm:border-[#D4AF37]/20 sm:pl-4">
              Limited allocations. First come, first served.
            </p>
          </div>
        </header>

        <div
          className={`grid items-start gap-10 lg:grid-cols-2 ${
            isMobileInvest ? "mt-8 lg:mt-16 lg:gap-12" : "mt-14 lg:mt-16 lg:gap-12"
          }`}
        >
          <div className="lg:pr-4">
            <div className="relative mt-10 flex justify-center lg:justify-start">
              <GoldRewardParticles count={8} seed={90} className="absolute -inset-3 overflow-visible" />
              <Link
                href="/investment-plans"
                className="relative inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-7 py-3.5 text-sm font-bold text-black shadow-[0_0_28px_rgba(212,175,55,0.35)] transition hover:bg-[#E5BD45]"
              >
                Secure My Position
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <FoundingInvestorPromoCard />
        </div>
      </div>
    </section>
  );
}
