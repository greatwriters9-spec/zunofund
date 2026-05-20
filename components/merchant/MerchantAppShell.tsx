"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ArrowRight, CheckCircle2, LayoutDashboard, PackagePlus, Shield, Store, UserRound, Zap } from "lucide-react";

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
    ? `${base} border-[#D4AF37]/50 bg-black/45 text-[#F5E6B3] ring-1 ring-[#D4AF37]/35`
    : `${base} border-white/10 bg-black/25 text-zinc-400 hover:border-[#D4AF37]/25 hover:text-[#F5E6B3]`;
}

/** Compact pill for the horizontal merchant rail (no icons). */
function merchantMobileRailClass(href: string, pathname: string | null): string {
  const active = isNavActive(pathname, href);
  const base = "rounded-lg border px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wide transition";
  return active
    ? `${base} border-[#D4AF37]/50 bg-black/45 text-[#F5E6B3] ring-1 ring-[#D4AF37]/35`
    : `${base} border-white/10 bg-black/25 text-zinc-400 hover:border-[#D4AF37]/25 hover:text-[#F5E6B3]`;
}

const iconCls = "h-[18px] w-[18px] shrink-0 text-[#D4AF37]/85";

const MERCHANT_MOBILE_NAV: { href: string; label: string }[] = [
  { href: "/merchant", label: "Dashboard" },
  { href: "/merchant/offers/new", label: "New offer" },
  { href: "/merchant/orders/active", label: "Active" },
  { href: "/merchant/orders/completed", label: "Completed" },
  { href: "/merchant/profile", label: "Profile" },
];

export function MerchantAppShell({
  children,
  heading,
  description,
}: {
  children: ReactNode;
  /** e.g. "Console" → rendered as Merchant · Console */
  heading?: string;
  description?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#03060c] text-white">
      <div className="flex min-h-screen min-w-0 flex-col lg:flex-row">
        <nav
          aria-label="Merchant shortcuts"
          className="sticky top-0 z-40 flex shrink-0 gap-2 overflow-x-auto border-b border-[#D4AF37]/15 bg-[#05080F]/95 px-3 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
        >
          {MERCHANT_MOBILE_NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`shrink-0 ${merchantMobileRailClass(href, pathname)}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-wrap items-center justify-center gap-2 border-b border-white/[0.07] bg-black/35 px-3 py-2.5 lg:hidden">
          <Link
            href="/dashboard"
            className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-[#D4AF37]/35 hover:text-[#F5E6B3]"
          >
            Investor dashboard
          </Link>
          <Link
            href="/p2p"
            className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1.5 text-[11px] font-semibold text-[#F5E6B3] transition hover:bg-[#D4AF37]/15"
          >
            P2P marketplace
          </Link>
        </div>

        <aside className="hidden w-full shrink-0 flex-col gap-6 overflow-y-auto border-b border-[#D4AF37]/15 bg-[#05080F]/95 p-5 lg:flex lg:min-h-screen lg:max-w-[380px] lg:border-b-0 lg:border-r xl:max-w-[430px]">
          <Link href="/merchant" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-black/35">
              <Store className="text-[#D4AF37]" size={22} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold tracking-tight text-[#F5E6B3]">Merchant</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">P2P console</p>
            </div>
          </Link>

          <nav className="flex flex-col gap-2">
            <Link href="/merchant" className={navLinkClass("/merchant", pathname)}>
              <LayoutDashboard className={iconCls} aria-hidden />
              Dashboard
            </Link>
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
            <Link href="/merchant/profile" className={navLinkClass("/merchant/profile", pathname)}>
              <UserRound className={iconCls} aria-hidden />
              Profile
            </Link>
          </nav>

          <div className="rounded-xl border border-white/10 bg-black/35 p-4">
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

          <p className="text-[10px] uppercase tracking-[0.12em] leading-relaxed text-zinc-600">
            Same chrome as investor P2P — sidebar rail, dark canvas, gold accent.
          </p>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pb-8 sm:pt-8">
          {(heading !== undefined || description !== undefined) && (
            <header className="mb-8 border-b border-[#D4AF37]/10 pb-5">
              {heading !== undefined && heading !== "" ? (
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  <span className="text-[#D4AF37]">Merchant</span>
                  <span className="text-zinc-500"> · </span>
                  <span>{heading}</span>
                </h1>
              ) : null}
              {description ? <p className="mt-2 max-w-2xl text-sm text-zinc-500">{description}</p> : null}
            </header>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
