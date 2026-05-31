"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PortfolioGrowthPanel } from "@/components/dashboard/PortfolioGrowthPanel";

export default function PortfolioGrowthPage() {
  return (
    <div className="min-h-screen bg-[#05080F] text-white">
      <div className="mx-auto max-w-5xl p-5 md:p-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-yellow-500 transition hover:text-yellow-400"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to dashboard
        </Link>

        <h1 className="mt-4 text-2xl font-bold tracking-tight">Portfolio growth</h1>
        <p className="mt-1 text-sm text-zinc-500">Real growth based on actual profits credited to your account.</p>

        <div className="mt-8 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
          <PortfolioGrowthPanel />
        </div>
      </div>
    </div>
  );
}
