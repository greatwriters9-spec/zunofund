"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Headset, Star } from "lucide-react";
import type { ReactNode } from "react";

const QUICK_ACTION_LABEL_CLASS =
  "w-full text-center text-[9px] font-normal leading-[1.15] tracking-tight text-zinc-100";
const QUICK_ACTION_ICON_CLASS = "h-4 w-4 shrink-0";
const ICON_STROKE = 2.25;
const ICON_BASE = "stroke-zinc-100";
const ICON_ACCENT = "stroke-yellow-500";

function TwoToneQuickIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={QUICK_ACTION_ICON_CLASS}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function ReferralQuickIcon() {
  return (
    <TwoToneQuickIcon>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" className={ICON_BASE} />
      <circle cx="9" cy="7" r="4" className={ICON_BASE} />
      <line x1="19" x2="19" y1="8" y2="14" className={ICON_ACCENT} />
      <line x1="22" x2="16" y1="11" y2="11" className={ICON_ACCENT} />
    </TwoToneQuickIcon>
  );
}

export function P2pQuickIcon() {
  return (
    <TwoToneQuickIcon>
      <path d="M8 3 4 7l4 4" className={ICON_BASE} />
      <path d="M4 7h16" className={ICON_BASE} />
      <path d="m16 21 4-4-4-4" className={ICON_ACCENT} />
      <path d="M20 17H4" className={ICON_ACCENT} />
    </TwoToneQuickIcon>
  );
}

export function RewardsQuickIcon() {
  return (
    <TwoToneQuickIcon>
      <path
        d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"
        className={ICON_BASE}
      />
      <path d="M20 2v4" className={ICON_ACCENT} />
      <path d="M22 4h-4" className={ICON_ACCENT} />
      <circle cx="4" cy="20" r="2" className={ICON_ACCENT} />
    </TwoToneQuickIcon>
  );
}

export function WithdrawQuickIcon() {
  return (
    <TwoToneQuickIcon>
      <path d="m18 9-6-6-6 6" className={ICON_ACCENT} />
      <path d="M12 3v14" className={ICON_BASE} />
      <path d="M5 21h14" className={ICON_BASE} />
    </TwoToneQuickIcon>
  );
}

type TileProps = {
  label: string;
  icon?: LucideIcon;
  iconNode?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  href?: string;
};

function QuickActionTile({ label, icon: Icon, iconNode, active, onClick, href }: TileProps) {
  const boxClass = `flex h-11 w-11 items-center justify-center rounded-xl border transition sm:h-12 sm:w-12 ${
    active
      ? "border-yellow-500/50 bg-yellow-500/15 ring-1 ring-yellow-500/30"
      : "border-zinc-800/90 bg-zinc-950/50 hover:border-yellow-500/40 hover:bg-zinc-900/80"
  }`;

  const inner =
    iconNode ??
    (Icon ? (
      <Icon className={`${QUICK_ACTION_ICON_CLASS} text-zinc-100`} aria-hidden strokeWidth={ICON_STROKE} />
    ) : null);

  return (
    <div className="flex min-w-0 flex-1 basis-0 flex-col items-center gap-1">
      {href ? (
        <Link href={href} className={boxClass} aria-label={label}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={boxClass} aria-label={label} aria-pressed={active}>
          {inner}
        </button>
      )}
      <span className={QUICK_ACTION_LABEL_CLASS}>{label}</span>
    </div>
  );
}

type DashboardQuickActionsProps = {
  referralOpen: boolean;
  onReferralToggle: () => void;
};

export function DashboardQuickActions({ referralOpen, onReferralToggle }: DashboardQuickActionsProps) {
  return (
    <div className="mt-4 grid w-full grid-cols-6 gap-0.5 lg:hidden">
      <QuickActionTile
        label="Referral"
        iconNode={<ReferralQuickIcon />}
        active={referralOpen}
        onClick={onReferralToggle}
      />
      <QuickActionTile label="Plans" icon={Star} href="/investment-plans" />
      <QuickActionTile label="P2P" iconNode={<P2pQuickIcon />} href="/p2p" />
      <QuickActionTile label="Support" icon={Headset} href="/support" />
      <QuickActionTile label="Rewards" iconNode={<RewardsQuickIcon />} href="/rewards" />
      <QuickActionTile label="Withdraw" iconNode={<WithdrawQuickIcon />} href="/withdraw" />
    </div>
  );
}
