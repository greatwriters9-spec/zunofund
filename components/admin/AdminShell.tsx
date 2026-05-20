"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ArrowDownCircle,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Settings,
  ShieldCheck,
  Store,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { useSupabase } from "@/lib/supabase";

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const supabase = useSupabase();

  function linkClass(href: string): string {
    const active =
      href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
    const base =
      "flex items-center gap-3 rounded-xl border px-4 py-3.5 text-sm font-semibold uppercase tracking-wide transition";
    return active
      ? `${base} border-[#D4AF37]/50 bg-black/45 text-[#F5E6B3] ring-1 ring-[#D4AF37]/35`
      : `${base} border-white/10 bg-black/25 text-zinc-400 hover:border-[#D4AF37]/25 hover:text-[#F5E6B3]`;
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/admin-login";
  }

  const iconCls = "h-[18px] w-[18px] shrink-0 text-[#D4AF37]/85";

  return (
    <div className="flex min-h-screen flex-col bg-[#03060c] text-white lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col justify-between gap-8 overflow-y-auto border-b border-[#D4AF37]/15 bg-[#05080F]/95 p-5 lg:h-screen lg:max-w-[380px] lg:border-b-0 lg:border-r xl:max-w-[430px]">
        <div>
          <Link href="/admin" className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-black/35">
              <ShieldCheck className="text-[#D4AF37]" size={24} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xl font-bold tracking-tight text-[#F5E6B3]">Admin</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                Trading control
              </p>
            </div>
          </Link>

          <nav className="flex flex-col gap-2">
            <Link href="/admin" className={linkClass("/admin")}>
              <LayoutDashboard className={iconCls} aria-hidden />
              Dashboard
            </Link>
            <Link href="/admin/deposits" className={linkClass("/admin/deposits")}>
              <Wallet className={iconCls} aria-hidden />
              Deposits
            </Link>
            <Link href="/admin/withdrawals" className={linkClass("/admin/withdrawals")}>
              <ArrowDownCircle className={iconCls} aria-hidden />
              Withdrawals
            </Link>
            <Link href="/admin/investors" className={linkClass("/admin/investors")}>
              <Users className={iconCls} aria-hidden />
              Investors
            </Link>
            <Link href="/admin/merchants" className={linkClass("/admin/merchants")}>
              <Store className={iconCls} aria-hidden />
              Merchants
            </Link>
            <Link href="/admin/profits" className={linkClass("/admin/profits")}>
              <TrendingUp className={iconCls} aria-hidden />
              Profits
            </Link>
            <Link href="/admin/support" className={linkClass("/admin/support")}>
              <MessageCircle className={iconCls} aria-hidden />
              Support
            </Link>
            <Link href="/admin/settings" className={linkClass("/admin/settings")}>
              <Settings className={iconCls} aria-hidden />
              Settings
            </Link>
          </nav>
        </div>

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/35 py-3.5 text-sm font-bold uppercase tracking-wide text-zinc-200 transition hover:border-red-400/35 hover:bg-red-500/10 hover:text-red-200"
        >
          <LogOut size={18} aria-hidden />
          Logout
        </button>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-auto p-6 sm:p-8">{children}</main>
    </div>
  );
}
