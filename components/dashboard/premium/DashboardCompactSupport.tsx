"use client";

import Link from "next/link";
import { Headset } from "lucide-react";

import { DASHBOARD_CARD, DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";
import { PlatformContactDisplay } from "@/components/contact/PlatformContactDisplay";

export function DashboardCompactSupport() {
  return (
    <div className={`${DASHBOARD_CARD} flex items-center justify-between gap-4 p-4 sm:p-5`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-[#D4AF37] ring-1 ring-white/[0.06]">
          <Headset className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">24/7 Support</p>
          <div className="text-xs" style={{ color: DASHBOARD_MUTED }}>
            <PlatformContactDisplay variant="compact" />
          </div>
        </div>
      </div>
      <Link
        href="/support"
        className="shrink-0 text-xs font-semibold text-[#D4AF37] transition hover:text-[#F5E6B3]"
      >
        Contact →
      </Link>
    </div>
  );
}
