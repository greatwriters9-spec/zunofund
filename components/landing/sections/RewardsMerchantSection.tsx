"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Store, Trophy } from "lucide-react";

export function RewardsMerchantSection() {
  return (
    <section className="bg-white px-6 py-20 text-zinc-900 lg:px-10 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
        <article className="overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-center bg-gradient-to-br from-[#D4AF37]/20 to-zinc-100 py-12">
            <Trophy className="h-24 w-24 text-[#D4AF37]" strokeWidth={1.25} aria-hidden />
          </div>
          <div className="p-8">
            <h2 className="text-2xl font-black md:text-3xl">Earn More With Zuno Rewards</h2>
            <p className="mt-3 text-zinc-600">
              Unlock loyalty tiers, reduced trading fees, referral incentives, and marketplace perks.
            </p>
            <Link href="/rewards" className="mt-6 inline-flex items-center gap-2 font-semibold text-[#D4AF37]">
              View all rewards <ArrowRight size={16} />
            </Link>
          </div>
        </article>

        <article className="overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
          <div className="relative h-48 overflow-hidden bg-[#070b12]">
            <Image
              src="/landing/hero-p2p-marketplace-crop.png"
              alt="Zuno merchant console and P2P marketplace preview"
              fill
              className="object-cover object-top opacity-90"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070b12] to-transparent" />
            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg border border-[#D4AF37]/30 bg-black/60 px-3 py-2">
              <Store className="h-4 w-4 text-[#D4AF37]" />
              <span className="text-xs font-semibold text-white">Merchant Console</span>
            </div>
          </div>
          <div className="p-8">
            <h2 className="text-2xl font-black md:text-3xl">Become A Verified Merchant</h2>
            <p className="mt-3 text-zinc-600">
              Publish secure offers, manage live trades, and access merchant dashboard tools.
            </p>
            <Link href="/merchant-requirements" className="mt-6 inline-flex items-center gap-2 font-semibold text-[#D4AF37]">
              Apply now <ArrowRight size={16} />
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
