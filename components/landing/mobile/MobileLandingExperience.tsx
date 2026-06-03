"use client";

import {
  MobileLandingStickyNav,
  useMobileLandingActiveTab,
} from "@/components/landing/mobile/MobileLandingStickyNav";
import { MobileLandingP2PSection } from "@/components/landing/mobile/MobileLandingP2PSection";

export function MobileLandingExperience() {
  const [activeTab, setActiveTab] = useMobileLandingActiveTab();

  return (
    <div className="relative lg:hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(85vh,640px)] bg-[radial-gradient(ellipse_90%_55%_at_50%_0%,rgba(212,175,55,0.14)_0%,transparent_58%)]"
      />

      <div className="relative mx-auto max-w-lg px-4 pb-2 pt-2">
        <article
          className="relative overflow-hidden rounded-[28px] border border-white/[0.1] bg-[linear-gradient(180deg,rgba(28,32,42,0.98)_0%,rgba(12,16,26,0.99)_42%,rgba(8,11,18,1)_100%)] shadow-[0_32px_80px_-24px_rgba(0,0,0,0.8),0_0_0_1px_rgba(212,175,55,0.08),0_20px_50px_-30px_rgba(212,175,55,0.25)]"
          aria-label="Trade crypto on Zuno"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#D4AF37]/12 blur-3xl"
          />

          <header className="relative px-5 pb-2 pt-6 text-center">
            <p className="mx-auto inline-flex items-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/12 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-[#F5E6B3]">
              Zuno · Trade. Invest. Grow.
            </p>
            <h1 className="mt-4 text-[1.65rem] font-bold leading-tight tracking-tight text-white">
              Buy and Sell Crypto{" "}
              <span className="text-[#D4AF37]">via Zuno</span>
            </h1>
            <MobileLandingStickyNav
              activeTab={activeTab}
              onTabChange={setActiveTab}
              variant="segment"
            />
            <p className="mx-auto max-w-[20rem] text-sm leading-relaxed text-zinc-400">
              Buy or sell crypto with 350+ payment options, including bank transfer, mobile money,
              gift cards, and more.
            </p>
          </header>

          <MobileLandingP2PSection embedded />
        </article>
      </div>
    </div>
  );
}
