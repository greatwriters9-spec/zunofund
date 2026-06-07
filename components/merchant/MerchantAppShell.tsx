"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ArrowRight,
  Bell,
  CheckCircle2,
  LayoutDashboard,
  PackagePlus,
  Shield,
  Store,
  UserRound,
  Zap,
} from "lucide-react";

import {
  MERCHANT_BG,
  MERCHANT_CARD,
  MERCHANT_GHOST_BTN,
  MERCHANT_GOLD,
  MERCHANT_HERO_GRADIENT,
  MERCHANT_MUTED,
} from "@/components/merchant/merchantStyles";

function isNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/merchant") return pathname === "/merchant";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClass(href: string, pathname: string | null): string {
  const active = isNavActive(pathname, href);
  const base =
    "flex items-center gap-3 rounded-xl border px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] transition sm:text-[13px]";
  return active
    ? `${base} border-[#D4AF37]/40 bg-[#D4AF37]/[0.08] text-[#F5E6B3] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-[#D4AF37]/25`
    : `${base} border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:border-[#D4AF37]/25 hover:bg-white/[0.04] hover:text-[#F5E6B3]`;
}

function merchantMobileRailClass(href: string, pathname: string | null): string {
  const active = isNavActive(pathname, href);
  const base =
    "shrink-0 rounded-xl border px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wide transition";
  return active
    ? `${base} border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#F5E6B3] ring-1 ring-[#D4AF37]/20`
    : `${base} border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:border-[#D4AF37]/25 hover:text-zinc-200`;
}

const iconCls = "h-[18px] w-[18px] shrink-0 text-[#D4AF37]/90";

const MERCHANT_MOBILE_NAV: { href: string; label: string }[] = [
  { href: "/merchant", label: "Dashboard" },
  { href: "/merchant/offers/new", label: "New offer" },
  { href: "/merchant/orders/active", label: "Active" },
  { href: "/merchant/orders/completed", label: "Completed" },
  { href: "/notifications", label: "Alerts" },
  { href: "/merchant/profile", label: "Profile" },
];

export function MerchantAppShell({
  children,
  heading,
  description,
  merchantStatus,
}: {
  children: ReactNode;
  heading?: string;
  description?: string;
  merchantStatus?: string | null;
}) {
  const pathname = usePathname();
  const canTrade = merchantStatus === "active";

  return (
    <div className="min-h-screen text-white lg:h-[100dvh] lg:overflow-hidden" style={{ backgroundColor: MERCHANT_BG }}>
      <div className="flex min-h-screen min-w-0 flex-col lg:h-full lg:min-h-0 lg:flex-row lg:overflow-hidden">
        <nav
          aria-label="Merchant shortcuts"
          className="sticky top-0 z-40 flex shrink-0 gap-2 overflow-x-auto border-b border-white/[0.06] bg-[rgba(8,12,20,0.92)] px-3 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-xl [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
        >
          {(canTrade ? MERCHANT_MOBILE_NAV : MERCHANT_MOBILE_NAV.filter((n) => n.href === "/merchant" || n.href === "/merchant/profile")).map(({ href, label }) => (
            <Link key={href} href={href} className={merchantMobileRailClass(href, pathname)}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-wrap items-center justify-center gap-2 border-b border-white/[0.06] bg-[rgba(8,12,20,0.55)] px-3 py-2.5 lg:hidden">
          <Link href="/dashboard" className={MERCHANT_GHOST_BTN}>
            Investor dashboard
          </Link>
          <Link
            href="/p2p"
            className="inline-flex items-center justify-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3.5 py-1.5 text-[11px] font-semibold text-[#F5E6B3] transition hover:bg-[#D4AF37]/15"
          >
            P2P marketplace
          </Link>
        </div>

        <aside className="hidden w-full shrink-0 flex-col gap-6 border-b border-white/[0.06] bg-[rgba(8,12,20,0.65)] p-5 backdrop-blur-md lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:max-h-[100dvh] lg:max-w-[380px] lg:overflow-y-auto lg:overscroll-contain lg:border-b-0 lg:border-r xl:max-w-[430px]">
          <Link href="/merchant" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 shadow-[0_4px_20px_rgba(212,175,55,0.12)]">
              <Store className="text-[#D4AF37]" size={22} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold tracking-tight text-[#F5E6B3]">Merchant</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: MERCHANT_MUTED }}>
                P2P console
              </p>
            </div>
          </Link>

          <nav className="flex flex-col gap-2">
            <Link href="/merchant" className={navLinkClass("/merchant", pathname)}>
              <LayoutDashboard className={iconCls} aria-hidden />
              Dashboard
            </Link>
            {canTrade ? (
              <>
                <Link href="/merchant/offers/new" className={navLinkClass("/merchant/offers/new", pathname)}>
                  <PackagePlus className={iconCls} aria-hidden />
                  New offer
                </Link>
                <Link href="/merchant/orders/active" className={navLinkClass("/merchant/orders/active", pathname)}>
                  <Zap className={iconCls} aria-hidden />
                  Active trades
                </Link>
                <Link href="/merchant/orders/completed" className={navLinkClass("/merchant/orders/completed", pathname)}>
                  <CheckCircle2 className={iconCls} aria-hidden />
                  Completed trades
                </Link>
                <Link href="/notifications" className={navLinkClass("/notifications", pathname)}>
                  <Bell className={iconCls} aria-hidden />
                  Notifications
                </Link>
              </>
            ) : null}
            <Link href="/merchant/profile" className={navLinkClass("/merchant/profile", pathname)}>
              <UserRound className={iconCls} aria-hidden />
              Profile
            </Link>
          </nav>

          <div className={`${MERCHANT_CARD} p-4`}>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#D4AF37]/90">Investor hub</p>
            <Link
              href="/dashboard"
              className="mt-3 flex items-center justify-between gap-2 text-sm font-medium text-zinc-300 transition hover:text-[#F5E6B3]"
            >
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#D4AF37]/80" aria-hidden />
                Investor dashboard
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
            </Link>
            <Link
              href="/p2p"
              className="mt-3 flex items-center justify-between gap-2 text-sm font-medium text-zinc-300 transition hover:text-[#F5E6B3]"
            >
              <span>Open marketplace →</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
            </Link>
          </div>
        </aside>

        <main className="relative min-h-0 min-w-0 flex-1 lg:overflow-y-auto lg:overscroll-contain">
          <div className={MERCHANT_HERO_GRADIENT} aria-hidden />
          <div className="relative mx-auto max-w-[1400px] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-8 sm:pt-4">
            {(heading !== undefined || description !== undefined) && (
              <header className="mb-6 border-b border-white/[0.06] pb-5 lg:mb-8">
                {heading !== undefined && heading !== "" ? (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
                      Merchant workspace
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem] lg:text-3xl">
                      <span style={{ color: MERCHANT_GOLD }}>Merchant</span>
                      <span className="text-zinc-500"> · </span>
                      <span>{heading}</span>
                    </h1>
                  </>
                ) : null}
                {description ? (
                  <p className="mt-2 hidden max-w-2xl text-sm leading-relaxed lg:block" style={{ color: MERCHANT_MUTED }}>
                    {description}
                  </p>
                ) : null}
              </header>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
