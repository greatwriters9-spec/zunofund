"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Headset, LogOut, UserRound } from "lucide-react";

import { InvestorMobileTopBar } from "@/components/investor/InvestorMobileTopBar";
import { DashboardMobileBottomNav } from "@/components/navigation/DashboardMobileBottomNav";
import { AccountBannedScreen } from "@/components/account/AccountBannedScreen";
import { useAuthUser } from "@/hooks/useAuthUser";
import { isPathAllowedForAccountStatus, useAccountStatus } from "@/lib/accountStatus";
import {
  INVESTOR_SIDEBAR_NAV,
  INVESTOR_TOP_NAV,
  isInvestorNavActive,
} from "@/lib/investorShellNav";
import { useSupabase } from "@/lib/supabase";

function BrandLockup() {
  return (
    <Link href="/dashboard" className="flex h-10 shrink-0 items-center gap-2">
      <Image
        src="/logo.png"
        alt="Zuno"
        width={32}
        height={32}
        className="h-8 w-auto object-contain"
        priority
      />
      <span className="text-sm font-semibold tracking-[0.2em] text-white">ZUNO</span>
    </Link>
  );
}

function InvestorSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-white/[0.06] bg-[#0A0F18] lg:flex">
      <div className="flex h-14 shrink-0 items-center border-b border-white/[0.06] px-4">
        <BrandLockup />
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="Account">
        {INVESTOR_SIDEBAR_NAV.map((item) => {
          const active = isInvestorNavActive(pathname ?? "", item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-200 ${
                active
                  ? "bg-gradient-to-r from-[#D4AF37]/15 to-transparent text-[#F5E6B3] shadow-[inset_0_0_20px_rgba(212,175,55,0.08)] ring-1 ring-[#D4AF37]/20"
                  : "text-[#8A93A5] hover:bg-white/[0.04] hover:text-zinc-100"
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 space-y-2 border-t border-white/[0.06] p-3">
        <Link
          href="/investment-plans"
          className="block rounded-xl bg-gradient-to-br from-[#D4AF37]/20 via-[#D4AF37]/10 to-transparent p-3 ring-1 ring-[#D4AF37]/20 transition hover:ring-[#D4AF37]/35"
        >
          <p className="text-xs font-semibold text-[#F5E6B3]">Upgrade Your Plan</p>
          <p className="mt-1 text-[10px] text-[#8A93A5]">Explore higher tiers</p>
        </Link>
        <Link
          href="/support"
          className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-[#D4AF37]/25 hover:bg-white/[0.04]"
        >
          <Headset className="h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-white">24/7 Support</p>
            <p className="text-[10px] text-[#8A93A5]">We&apos;re here 24/7</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}

function InvestorTopBar() {
  const pathname = usePathname();
  const supabase = useSupabase();

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-50 hidden h-14 shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] bg-[rgba(5,7,13,0.92)] px-6 backdrop-blur-xl supports-[backdrop-filter]:bg-[rgba(5,7,13,0.82)] lg:flex">
      <nav className="hidden items-center gap-6 xl:flex" aria-label="Primary">
        {INVESTOR_TOP_NAV.map((item) => {
          const active =
            pathname === item.href || (pathname?.startsWith(`${item.href}/`) ?? false);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition ${
                active ? "text-[#D4AF37]" : "text-[#8A93A5] hover:text-zinc-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
        <Link
          href="/deposit"
          className="rounded-xl bg-gradient-to-r from-[#F7E3A0] via-[#D4AF37] to-[#EAC54F] px-4 py-2 text-sm font-bold text-black shadow-[0_0_20px_rgba(212,175,55,0.2)] transition hover:brightness-105"
        >
          Deposit
        </Link>
        <Link
          href="/withdraw"
          className="hidden rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-white/[0.2] sm:inline-flex"
        >
          Withdraw
        </Link>
        <Link
          href="/notifications"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-[#8A93A5] transition hover:border-[#D4AF37]/30 hover:text-[#D4AF37]"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" aria-hidden />
        </Link>
        <Link
          href="/dashboard/profile"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-[#8A93A5] transition hover:border-[#D4AF37]/30 hover:text-[#D4AF37]"
          aria-label="Account"
        >
          <UserRound className="h-5 w-5" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="hidden items-center gap-1.5 rounded-xl border border-white/[0.06] px-3 py-2 text-xs font-medium text-[#8A93A5] transition hover:border-red-500/30 hover:text-red-400 lg:inline-flex"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Logout
        </button>
      </div>
    </header>
  );
}

type InvestorDesktopShellProps = {
  children: React.ReactNode;
};

/**
 * Binance-style desktop shell: left sidebar + top bar + scrollable main.
 * Below `lg`, children render full-width with no shell (mobile layout unchanged).
 */
export function InvestorDesktopShell({ children }: InvestorDesktopShellProps) {
  const { isAuthenticated } = useAuthUser();
  const { status, snapshot, loading: statusLoading } = useAccountStatus();
  const pathname = usePathname();
  const hideMobileChrome = (pathname ?? "").startsWith("/p2p/order/");

  if (
    isAuthenticated &&
    !statusLoading &&
    status === "banned" &&
    !isPathAllowedForAccountStatus(status, pathname ?? "")
  ) {
    return <AccountBannedScreen snapshot={snapshot} />;
  }

  if (isAuthenticated && statusLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#05070D] text-sm text-zinc-400">
        Checking account status…
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#05070D] text-white lg:pl-[232px]">
      <InvestorSidebar />
      <div className="flex min-h-[100dvh] min-w-0 flex-col lg:h-[100dvh]">
        <InvestorTopBar />
        {isAuthenticated && !hideMobileChrome ? <InvestorMobileTopBar /> : null}
        <main
          className={`min-h-0 flex-1 bg-[#05070D] ${
            isAuthenticated
              ? hideMobileChrome
                ? "overflow-hidden pb-0 pt-0 lg:overflow-y-auto lg:pb-0 lg:pt-0"
                : "pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-[calc(3.5rem+max(0.5rem,env(safe-area-inset-top)))] lg:overflow-y-auto lg:pb-0 lg:pt-0"
              : "lg:overflow-y-auto"
          }`}
        >
          {children}
        </main>
        {isAuthenticated && !hideMobileChrome ? <DashboardMobileBottomNav /> : null}
      </div>
    </div>
  );
}
