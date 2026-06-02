"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { LANDING_PLANS } from "@/components/landing/landingData";

export function InvestmentPlansSection() {
  return (
    <section id="plans" className="relative px-6 py-20 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">Investment Plans</p>
          <h2 className="mt-3 text-3xl font-black text-white md:text-5xl">
            Choose A Plan That Fits <span className="text-[#D4AF37]">Your Goals</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            Founding-member pricing and perks are available for a limited time—join before the early access
            window closes.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {LANDING_PLANS.map((plan, index) => (
            <motion.article
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="flex flex-col rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
            >
              <div className="inline-flex w-fit rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3 py-1 text-xs font-semibold text-[#F5E6B3]">
                {plan.range}
              </div>
              <h3 className="mt-4 text-2xl font-bold text-white">{plan.name}</h3>
              <p className="mt-2 text-lg font-semibold text-[#D4AF37]">{plan.roi}</p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-400">{plan.description}</p>
              <ul className="mt-5 space-y-2">
                {plan.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2 text-sm text-zinc-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#D4AF37]" />
                    {benefit}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth?signup=1"
                className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 py-3 text-sm font-semibold transition hover:border-[#D4AF37]/50 hover:bg-zinc-800"
              >
                {plan.button}
                <ArrowRight size={16} />
              </Link>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
