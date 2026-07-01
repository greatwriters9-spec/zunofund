"use client";

import { Clock, Lock, ShieldCheck } from "lucide-react";

import { GoldRewardParticles, GoldShimmerSweep } from "@/components/landing/GoldRewardParticles";
import { GrowthChart } from "@/components/landing/GrowthChart";
import { padCountdown, useEnrollmentCountdown } from "@/components/landing/useEnrollmentCountdown";
import { maxDailyRoiHeadline } from "@/lib/platformConfig/helpers";
import { usePlatformConfig } from "@/lib/platformConfig";

type FoundingInvestorPromoCardProps = {
  className?: string;
};

export function FoundingInvestorPromoCard({ className = "" }: FoundingInvestorPromoCardProps) {
  const { config } = usePlatformConfig();
  const timeLeft = useEnrollmentCountdown();
  const countdownSegments = timeLeft
    ? [
        { value: padCountdown(timeLeft.days), label: "Days" },
        { value: padCountdown(timeLeft.hours), label: "Hrs" },
        { value: padCountdown(timeLeft.minutes), label: "Mins" },
        { value: padCountdown(timeLeft.seconds), label: "Secs" },
      ]
    : [
        { value: "00", label: "Days" },
        { value: "00", label: "Hrs" },
        { value: "00", label: "Mins" },
        { value: "00", label: "Secs" },
      ];

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border border-[#D4AF37]/25 bg-[rgba(8,15,28,0.72)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45),0_0_48px_rgba(212,175,55,0.12)] backdrop-blur-xl sm:p-8 ${className}`}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[#D4AF37]/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 left-1/4 h-32 w-32 rounded-full bg-[#D4AF37]/10 blur-3xl" />
      <GoldRewardParticles count={14} seed={10} className="absolute inset-0" />
      <GoldShimmerSweep />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <GoldRewardParticles count={9} seed={25} className="absolute -inset-2 overflow-visible" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/80">
            Potential Daily Returns
          </p>
          <p className="gold-gradient relative mt-2 text-3xl font-bold leading-none sm:text-4xl lg:text-5xl">
            {maxDailyRoiHeadline(config.plans)}
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-400">
            Structured growth allocations designed for early investors.
          </p>
        </div>
        <GrowthChart />
      </div>

      <div className="relative mt-8 grid gap-4 rounded-2xl border border-white/[0.06] bg-black/30 p-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-white/[0.06] sm:p-5">
        <GoldRewardParticles count={8} seed={60} className="absolute inset-0 overflow-visible" />
        <div className="text-center sm:px-3">
          <Clock className="mx-auto h-4 w-4 text-[#D4AF37]" aria-hidden />
          <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Enrollment Ends 1st January 2027
          </p>
          <div className="mt-2 flex items-center justify-center gap-1 tabular-nums">
            {countdownSegments.map(({ value, label }, index) => (
              <div key={label} className="flex items-center gap-1">
                {index > 0 ? (
                  <span className="mb-3 text-sm font-bold text-[#D4AF37]/60">:</span>
                ) : null}
                <div>
                  <p className="text-lg font-bold text-[#F5E6B3] sm:text-xl">{value}</p>
                  <p className="text-[8px] uppercase tracking-wider text-zinc-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center sm:px-3">
          <Lock className="mx-auto h-4 w-4 text-[#D4AF37]" aria-hidden />
          <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Secure Escrow
          </p>
          <p className="mt-2 text-sm font-bold text-[#F5E6B3]">Protected Deposits</p>
          <p className="mt-1 text-xs text-zinc-500">Institutional-grade custody.</p>
        </div>

        <div className="text-center sm:px-3">
          <ShieldCheck className="mx-auto h-4 w-4 text-[#D4AF37]" aria-hidden />
          <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Program Status
          </p>
          <p className="mt-2 text-sm font-bold text-[#F5E6B3]">Exclusively for early investors</p>
          <p className="mt-1 text-xs text-zinc-500">Secure Your Spot Now.</p>
        </div>
      </div>

      <p className="relative mt-6 flex items-center justify-center gap-2 text-center text-xs text-zinc-500">
        <Lock className="h-3 w-3 shrink-0 text-zinc-600" aria-hidden />
        Your investment. Our priority. Your growth. Our mission.
      </p>
    </div>
  );
}
