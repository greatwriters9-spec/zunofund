"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { SiBitcoin, SiEthereum, SiLitecoin, SiTether } from "react-icons/si";

import { MobileLandingP2PSection } from "@/components/landing/mobile/MobileLandingP2PSection";
import {
  MOBILE_LANDING_TABS,
  MOBILE_CRYPTO_ASSETS,
  type MobileLandingTabId,
} from "@/components/landing/mobile/mobileLandingData";
import {
  scrollToMobileLandingSection,
  useMobileLandingActiveTab,
} from "@/components/landing/mobile/MobileLandingStickyNav";
import { signupHref } from "@/lib/authLinks";

const CRYPTO_ICONS = {
  BTC: SiBitcoin,
  ETH: SiEthereum,
  USDT: SiTether,
  LTC: SiLitecoin,
} as const;

export function MobileLandingExperience() {
  const [activeTab, setActiveTab] = useMobileLandingActiveTab();

  const handleTabChange = useCallback(
    (tab: MobileLandingTabId) => {
      setActiveTab(tab);
      const target = MOBILE_LANDING_TABS.find((item) => item.id === tab);
      if (target) scrollToMobileLandingSection(target.targetId);
    },
    [setActiveTab],
  );

  return (
    <div className="relative lg:hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_90%_60%_at_50%_0%,rgba(212,175,55,0.12)_0%,transparent_70%)]"
      />

      <section id="home" className="relative px-3 pt-10 text-center">
        <h1 className="font-extrabold leading-[2.25] tracking-tight">
          <span className="block text-[2.0rem] text-white">Don&apos;t Buy & Hold Crypto</span>
          <span className="gold-gradient mt-1 block text-[1.85rem]">Invest With Zuno</span>
          <span className="mt-6 block text-[1rem] font-semibold text-white">
            The Future of P2P{" "}
            <span className="text-[#D4AF37]">Digital Finance.</span>
          </span>
        </h1>

        <div className="mt-10 flex gap-1.5">
          <Link
            href={signupHref(null)}
            className="flex flex-1 items-center justify-center gap-3.5 rounded-xl bg-[#D4AF37] py-3.5 text-sm font-bold text-black shadow-[0_0_20px_rgba(212,175,55,0.28)]"
          >
            Sign Up
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/auth"
            className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-white/20 bg-transparent py-3.5 text-sm font-semibold text-white"
          >
            Explore Marketplace
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="mt-10 flex items-center justify-center gap-6">
          {MOBILE_CRYPTO_ASSETS.map(({ symbol, color }) => {
            const Icon = CRYPTO_ICONS[symbol];
            return (
              <div key={symbol} className="flex flex-col items-center gap-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03]">
                  <Icon className="h-4 w-4" style={{ color }} aria-hidden />
                </div>
                <span className="text-[9px] font-medium text-zinc-400">{symbol}</span>
              </div>
            );
          })}
        </div>

        <div
          aria-hidden
          className="mx-auto mt-10 h-px w-[88%] bg-gradient-to-r from-transparent via-[#D4AF37]/35 to-transparent"
        />
      </section>

      <MobileLandingP2PSection activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
}
