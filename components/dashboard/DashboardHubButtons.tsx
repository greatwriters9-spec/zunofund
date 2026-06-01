"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { BarChart3, History, LineChart, Store, X } from "lucide-react";

const LABEL_CLASS =
  "w-full px-0.5 text-center text-[9px] font-normal leading-[1.15] tracking-tight text-zinc-100 line-clamp-2";

const ICON_CONTROL_CLASS =
  "inline-flex items-center justify-center p-0 text-zinc-100 transition active:text-yellow-500";

function HubTile({
  label,
  icon: Icon,
  href,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
}) {
  const inner = <Icon className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />;

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-0.5">
      {href ? (
        <Link href={href} className={ICON_CONTROL_CLASS} aria-label={label}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={ICON_CONTROL_CLASS} aria-label={label}>
          {inner}
        </button>
      )}
      <span className={LABEL_CLASS}>{label}</span>
    </div>
  );
}

type DashboardHubButtonsProps = {
  merchantStatus: string | null | undefined;
};

export function DashboardHubButtons({ merchantStatus }: DashboardHubButtonsProps) {
  const router = useRouter();
  const [merchantModalOpen, setMerchantModalOpen] = useState(false);

  const status = (merchantStatus ?? "").toLowerCase();
  const isMerchant = status === "active" || status === "pending";

  function handleMerchant() {
    if (isMerchant) {
      router.push("/merchant");
      return;
    }
    setMerchantModalOpen(true);
  }

  function goToMerchantUnlock() {
    setMerchantModalOpen(false);
    router.push("/rewards#merchant-eligibility");
  }

  return (
    <>
      <nav
        aria-label="Dashboard shortcuts"
        className="max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:z-[100] max-md:border-t max-md:border-zinc-800/90 max-md:bg-[#05080F]/95 max-md:px-2 max-md:pt-2 max-md:pb-[max(0.5rem,env(safe-area-inset-bottom))] max-md:shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.75)] max-md:backdrop-blur-md max-md:supports-[backdrop-filter]:bg-[#05080F]/90 md:hidden"
      >
        <div className="dashboard-mobile-grid grid w-full min-w-0 auto-rows-min grid-cols-4 gap-1">
          <HubTile label="Portfolio growth" icon={BarChart3} href="/dashboard/growth" />
          <HubTile label="Merchant" icon={Store} onClick={handleMerchant} />
          <HubTile label="Market" icon={LineChart} href="/markets" />
          <HubTile label="History" icon={History} href="/history" />
        </div>
      </nav>

      {merchantModalOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="merchant-unlock-title"
          onClick={() => setMerchantModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setMerchantModalOpen(false)}
              className="absolute right-3 top-3 rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:text-white"
              aria-label="Close"
            >
              <X size={16} aria-hidden />
            </button>
            <h2 id="merchant-unlock-title" className="pr-8 text-lg font-bold text-white">
              Unlock merchant access
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Keep investing and reach Elite tier to unlock the merchant program. You can review
              requirements and eligibility on the Rewards page.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setMerchantModalOpen(false)}
                className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-semibold text-zinc-300 hover:border-zinc-600"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={goToMerchantUnlock}
                className="flex-1 rounded-xl bg-yellow-500 py-2.5 text-sm font-bold text-black hover:bg-yellow-400"
              >
                View how to unlock
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
