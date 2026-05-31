"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { RewardsCenterView } from "@/components/rewards/RewardsCenterView";

export default function RewardsPage() {
  return (
    <div className="min-h-screen bg-[#05080F] text-white">
      <div className="mx-auto max-w-4xl p-5 md:p-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-yellow-500 transition hover:text-yellow-400"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to dashboard
        </Link>
        <div className="mt-6">
          <RewardsCenterView />
        </div>
      </div>
    </div>
  );
}
