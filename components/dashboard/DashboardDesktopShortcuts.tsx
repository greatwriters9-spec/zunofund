"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Headset, History, LineChart, Star, Store, X } from "lucide-react";
import {
  P2pQuickIcon,
  ReferralQuickIcon,
  RewardsQuickIcon,
  WithdrawQuickIcon,
} from "@/components/dashboard/DashboardQuickActions";

const LABEL_CLASS =
  "text-center text-sm font-normal leading-snug tracking-tight text-zinc-100";

const BOX_CLASS =
  "flex h-12 w-full items-center justify-center rounded-xl border border-zinc-800/90 bg-zinc-950/50 transition hover:border-yellow-500/40 hover:bg-zinc-900/80";

const ICON_CLASS = "h-[22px] w-[22px] text-zinc-100";

function DesktopShortcut({
  label,
  icon: Icon,
  iconNode,
  href,
  onClick,
  active,
}: {
  label: string;
  icon?: LucideIcon;
  iconNode?: ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const boxClass = active
    ? `${BOX_CLASS} border-yellow-500/50 bg-yellow-500/15 ring-1 ring-yellow-500/30`
    : BOX_CLASS;

  const inner =
    iconNode ??
    (Icon ? <Icon className={ICON_CLASS} strokeWidth={2.25} aria-hidden /> : null);

  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      {href ? (
        <Link href={href} className={boxClass} aria-label={label}>
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className={boxClass}
          aria-label={label}
          aria-pressed={active}
        >
          {inner}
        </button>
      )}
      <span className={LABEL_CLASS}>{label}</span>
    </div>
  );
}

type DashboardDesktopShortcutsProps = {
  referralOpen: boolean;
  onReferralToggle: () => void;
  merchantStatus: string | null | undefined;
};

export function DashboardDesktopShortcuts({
  referralOpen,
  onReferralToggle,
  merchantStatus,
}: DashboardDesktopShortcutsProps) {
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
        className="mb-7 hidden md:grid md:grid-cols-5 md:gap-x-4 md:gap-y-6"
      >
        <DesktopShortcut
          label="Referral"
          iconNode={<ReferralQuickIcon />}
          active={referralOpen}
          onClick={onReferralToggle}
        />
        <DesktopShortcut label="Plans" icon={Star} href="/investment-plans" />
        <DesktopShortcut label="P2P" iconNode={<P2pQuickIcon />} href="/p2p" />
        <DesktopShortcut label="Support" icon={Headset} href="/support" />
        <DesktopShortcut label="Rewards" iconNode={<RewardsQuickIcon />} href="/rewards" />
        <DesktopShortcut label="Withdraw" iconNode={<WithdrawQuickIcon />} href="/withdraw" />
        <DesktopShortcut label="Portfolio growth" icon={BarChart3} href="/dashboard#portfolio-growth" />
        <DesktopShortcut label="Merchant" icon={Store} onClick={handleMerchant} />
        <DesktopShortcut label="Market" icon={LineChart} href="/markets" />
        <DesktopShortcut label="History" icon={History} href="/history" />
      </nav>

      {merchantModalOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="merchant-unlock-title-desktop"
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
            <h2 id="merchant-unlock-title-desktop" className="pr-8 text-lg font-bold text-white">
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
