"use client";

import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";

export function FinalCTASection() {
  return (
    <section className="relative px-6 py-20 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-3xl font-black text-white md:text-5xl">
          Join The Future Of <span className="text-[#D4AF37]">Digital Finance</span>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-zinc-400">
          Create your account, explore the global marketplace, and start trading with verified merchants today.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/auth?signup=1"
            className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-7 py-3.5 text-base font-semibold text-black transition hover:bg-[#E5BD45]"
          >
            Create Account
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/download"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-600 px-7 py-3.5 text-base font-semibold text-white transition hover:border-[#D4AF37]/50"
          >
            <Download size={18} />
            Download App
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-600 px-7 py-3.5 text-base font-semibold text-white transition hover:border-[#D4AF37]/50"
          >
            Join Telegram
          </Link>
        </div>
      </div>
    </section>
  );
}
