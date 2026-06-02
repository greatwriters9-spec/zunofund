"use client";

import { motion } from "framer-motion";
import { Banknote, Clock, Globe, ShieldAlert, Wallet } from "lucide-react";

import { PROBLEM_CARDS } from "@/components/landing/landingData";

const ICONS = [Banknote, Wallet, Clock, ShieldAlert, Globe] as const;

export function ProblemSection() {
  return (
    <section id="problem" className="bg-white px-6 pb-20 pt-12 text-zinc-900 lg:px-10 lg:pb-28 lg:pt-14">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-black leading-tight md:text-4xl lg:text-5xl">
            Why is buying crypto still so{" "}
            <span className="text-[#D4AF37]">complicated?</span>
          </h2>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {PROBLEM_CARDS.map((card, i) => {
            const Icon = ICONS[i] ?? Globe;
            return (
              <motion.article
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
              >
                <div className="mb-4 inline-flex rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 p-2.5">
                  <Icon className="h-5 w-5 text-[#D4AF37]" aria-hidden />
                </div>
                <h3 className="text-lg font-bold text-zinc-900">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{card.text}</p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
