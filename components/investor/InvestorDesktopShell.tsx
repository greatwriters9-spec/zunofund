"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, UserRound } from "lucide-react";

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
    <aside className="hidden w-[220px] shrink-0 flex-col border-r border-zinc-800/90 bg-[#05080F] lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:max-h-[100dvh] lg:overflow-hidden">
      <div className="flex h-14 items-center border-b border-zinc-800/90 px-4">
        <BrandLockup />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3" aria-label="Account">
        {INVESTOR_SIDEBAR_NAV.map((item) => {
          const active = isInvestorNavActive(pathname ?? "", item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-zinc-900/80 text-yellow-500"
                  : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-100"
              }`}
            >
              {active ? (
                <span
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-yellow-500"
                  aria-hidden
                />
              ) : null}
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
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
    <header className="sticky top-0 z-50 hidden h-14 shrink-0 items-center justify-between gap-4 border-b border-zinc-800/90 bg-[#05080F]/95 px-6 backdrop-blur-md lg:flex">
      <nav className="hidden items-center gap-6 xl:flex" aria-label="Primary">
        {INVESTOR_TOP_NAV.map((item) => {
          const active =
            pathname === item.href || (pathname?.startsWith(`${item.href}/`) ?? false);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition ${
                active ? "text-yellow-500" : "text-zinc-400 hover:text-zinc-100"
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
          className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-yellow-400"
        >
          Deposit
        </Link>
        <Link
          href="/withdraw"
          className="hidden rounded-md border border-zinc-700 bg-zinc-900/60 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-zinc-600 sm:inline-flex"
        >
          Withdraw
        </Link>
        <Link
          href="/notifications"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-900 hover:text-yellow-500"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" aria-hidden />
        </Link>
        <Link
          href="/dashboard/profile"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-300 transition hover:border-yellow-500/40 hover:text-yellow-500"
          aria-label="Account"
        >
          <UserRound className="h-5 w-5" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="hidden items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-500 transition hover:border-red-500/40 hover:text-red-400 lg:inline-flex"
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
  return (
    <div className="min-h-screen bg-[#05080F] text-white max-lg:min-h-0 lg:flex lg:h-[100dvh] lg:overflow-hidden">
      <InvestorSidebar />
      <div className="flex min-w-0 flex-col max-lg:w-full lg:min-h-0 lg:flex-1">
        <InvestorTopBar />
        <main className="w-full min-w-0 bg-[#05080F] max-lg:overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
