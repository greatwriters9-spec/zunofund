"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpDown, Search, ShieldCheck, Users } from "lucide-react";

import { CryptoPicker } from "@/components/market-pickers/CryptoPicker";
import { PaymentMethodPicker } from "@/components/payment-methods/PaymentMethodPicker";
import { signupHref } from "@/lib/authLinks";
import { VISION_STATS } from "@/components/landing/landingData";

type MobileLandingP2PSectionProps = {
  embedded?: boolean;
};

export function MobileLandingP2PSection({ embedded = false }: MobileLandingP2PSectionProps) {
  const [wantCrypto, setWantCrypto] = useState("ALL");
  const [paymentMethod, setPaymentMethod] = useState("");

  return (
    <section
      id="mobile-p2p"
      className={embedded ? "relative scroll-mt-28 px-4 pb-6 pt-2" : "scroll-mt-28 px-4 pb-10 pt-6"}
    >
      <div className={embedded ? "relative space-y-0" : "mx-auto max-w-lg space-y-6"}>
        <div className={embedded ? "space-y-0" : "space-y-4 rounded-2xl border border-zinc-800/90 bg-zinc-950/50 p-4"}>
          <CryptoPicker
            variant="landing"
            fieldLabel="I want"
            value={wantCrypto}
            onChange={setWantCrypto}
            context="landing"
            allowAllCrypto
            sheetOverlayClassName="lg:hidden"
          />

          <div className="relative z-10 -my-3 flex justify-center">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#05080F] bg-[#D4AF37] text-black shadow-[0_6px_20px_-4px_rgba(212,175,55,0.55)]"
              aria-hidden
            >
              <ArrowUpDown className="h-5 w-5" strokeWidth={2.5} />
            </span>
          </div>

          <PaymentMethodPicker
            variant="landing"
            fieldLabel="I have"
            value={paymentMethod}
            onChange={setPaymentMethod}
            allowAllMethods={false}
            sheetOverlayClassName="lg:hidden"
            tone="muted"
          />

          <div className="pt-4">
            <Link
              href={signupHref(null)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D4AF37] py-4 text-base font-bold text-black shadow-[0_10px_28px_-8px_rgba(212,175,55,0.6)] transition hover:bg-[#E5BD45]"
            >
              <Search className="h-5 w-5" aria-hidden />
              Find offers
            </Link>
          </div>

          <div className="mt-4 flex items-center justify-center gap-6 border-t border-white/[0.06] pt-4 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 text-[#D4AF37]" aria-hidden />
              <span>
                <span className="font-semibold text-zinc-200">2.4M+</span> active traders
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#D4AF37]" aria-hidden />
              Escrow protected
            </span>
          </div>
        </div>

        <Link
          href="/download"
          className="mt-5 flex items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-center text-xs text-zinc-400 transition hover:border-[#D4AF37]/25 hover:text-zinc-300"
        >
          <span>Download Zuno app</span>
          <span className="text-zinc-600">·</span>
          <span>Android &amp; iOS available</span>
        </Link>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {VISION_STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/[0.07] bg-black/20 px-3 py-3.5"
            >
              <p className="text-[10px] font-medium uppercase leading-snug tracking-wide text-zinc-500">
                {stat.label}
              </p>
              <p className="mt-1 text-xl font-black tabular-nums leading-none text-[#D4AF37]">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
