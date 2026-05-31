"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { BarChart3, History, LineChart, Store, X } from "lucide-react";

const LABEL_CLASS =
  "text-center text-[10px] font-normal leading-tight tracking-tight text-zinc-100 max-md:line-clamp-2 md:text-sm md:leading-normal md:line-clamp-none";

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
  const boxClass =
    "flex w-full items-center justify-center rounded-xl border border-zinc-800/90 bg-zinc-950/50 transition hover:border-yellow-500/40 hover:bg-zinc-900/80 max-md:h-11 max-md:min-w-0 max-md:flex-1 md:h-12 md:max-w-none md:flex-1";

  const inner = (
    <Icon
      className="h-5 w-5 text-zinc-100 md:h-[22px] md:w-[22px]"
      strokeWidth={2.25}
      aria-hidden
    />
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      {href ? (
        <Link href={href} className={boxClass} aria-label={label}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={boxClass} aria-label={label}>
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
        <div className="flex w-full items-start justify-between gap-2 max-md:items-end max-md:gap-1.5 md:gap-3">
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
