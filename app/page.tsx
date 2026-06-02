"use client";

import { useEffect } from "react";

import { landingAuthForwardPath } from "@/lib/auth/supabaseEmailLink";

import { MarketingNavbar } from "@/components/navbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { DownloadAppSection } from "@/components/landing/sections/DownloadAppSection";
import { FinalCTASection } from "@/components/landing/sections/FinalCTASection";
import { GrowthProgramSection } from "@/components/landing/sections/GrowthProgramSection";
import { HeroSection } from "@/components/landing/sections/HeroSection";
import { HowItWorksSection } from "@/components/landing/sections/HowItWorksSection";
import { InvestmentPlansSection } from "@/components/landing/sections/InvestmentPlansSection";
import { ProblemSection } from "@/components/landing/sections/ProblemSection";
import { RewardsMerchantSection } from "@/components/landing/sections/RewardsMerchantSection";
import { RoadmapSection } from "@/components/landing/sections/RoadmapSection";
import { VisionSection } from "@/components/landing/sections/VisionSection";

export default function HomePage() {
  /** Supabase may redirect magic links to Site URL (`/`) — forward to signup callback or reset flow. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (path !== "/") return;
    const forwardPath = landingAuthForwardPath(url);
    if (!forwardPath) return;

    const dest = new URL(forwardPath, url.origin);
    url.searchParams.forEach((v, k) => dest.searchParams.set(k, v));
    window.location.replace(dest.pathname + dest.search + url.hash);
  }, []);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#05080F] text-white">
      <MarketingNavbar />
      <HeroSection />
      <ProblemSection />
      <VisionSection />
      <HowItWorksSection />
      <GrowthProgramSection />
      <InvestmentPlansSection />
      <RewardsMerchantSection />
      <RoadmapSection />
      <DownloadAppSection />
      <FinalCTASection />
      <LandingFooter />
    </main>
  );
}
