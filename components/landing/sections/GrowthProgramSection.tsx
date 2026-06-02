"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Gift } from "lucide-react";

import { EARLY_MEMBER_PROMOTION } from "@/components/landing/landingData";

export function GrowthProgramSection() {
  return (
    <section className="relative px-6 py-20 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <header className="mx-auto max-w-5xl text-center">
          <div
            aria-hidden
            className="mx-auto mb-8 h-px w-28 bg-gradient-to-r from-transparent via-[#D4AF37]/70 to-transparent sm:w-40"
          />
          <h2 className="gold-gradient text-[2.25rem] font-semibold leading-[1.1] tracking-[0.02em] sm:text-5xl md:text-6xl lg:text-[4.5rem]">
            Early Member Growth Program
          </h2>
          <div
            aria-hidden
            className="mx-auto mt-8 flex items-center justify-center gap-4"
          >
            <span className="h-px w-12 bg-[#D4AF37]/25 sm:w-20" />
            <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-zinc-500">
              Limited time
            </span>
            <span className="h-px w-12 bg-[#D4AF37]/25 sm:w-20" />
          </div>
          <p className="gold-gradient mt-6 text-[2.5rem] font-black leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Ends {EARLY_MEMBER_PROMOTION.endDateLabel}
          </p>
          <p className="mx-auto mt-8 max-w-2xl text-xl font-medium leading-snug text-white/90 md:text-2xl">
            Unlock Exclusive Benefits As An Early Member
          </p>
          <div
            aria-hidden
            className="mx-auto mt-10 h-px w-full max-w-md bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent"
          />
        </header>

        <div className="mt-14 grid items-center gap-10 lg:mt-20 lg:grid-cols-2">
          <div className="lg:pr-6">
            <p className="text-center text-base leading-relaxed text-zinc-400 lg:text-left lg:text-lg">
              This launch promotion is for people who join early. Enroll before{" "}
              <span className="font-medium text-zinc-300">{EARLY_MEMBER_PROMOTION.endDateLabel}</span> to Participate
              in daily investment program, referral rewards, and priority marketplace features while the growth
              phase is open.
            </p>

            <ul className="mt-8 space-y-3 text-sm text-zinc-300 lg:text-base">
              {[
                "Referral rewards for active network growth",
                "Reduced execution fees on qualified volume",
                "Higher merchant unlock eligibility",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37] lg:h-5 lg:w-5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex justify-center lg:justify-start">
              <Link
                href="/investment-plans"
                className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#E5BD45]"
              >
                View Investment Plans
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-zinc-800 bg-gradient-to-br from-[#101826] to-[#070b12] p-8">
            <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[#D4AF37]/15 blur-3xl" />
            <div className="relative flex flex-col items-center justify-center gap-6 sm:flex-row">
              <div className="flex h-28 w-28 items-center justify-center rounded-3xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 shadow-[0_0_40px_rgba(212,175,55,0.2)]">
                <Gift className="h-14 w-14 text-[#D4AF37]" aria-hidden />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Member growth</p>
                <p className="mt-1 text-4xl font-black text-[#D4AF37]">Earn up to 15% Daily</p>
                <p className="mt-2 text-sm text-zinc-400">Structured plan allocations on Zuno.</p>
              </div>
            </div>
            <div className="relative mt-8 h-36 rounded-2xl border border-zinc-800 bg-black/40 p-4">
              <div className="flex h-full items-end justify-center gap-2">
                {[35, 50, 65, 80, 100].map((h) => (
                  <div
                    key={h}
                    className="w-8 rounded-t-md bg-gradient-to-t from-[#D4AF37] to-[#F5E6B3]"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
