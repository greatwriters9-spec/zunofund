"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowRight, Bell, Headset, Menu, UserRound, X } from "lucide-react";

import { loginHref, signupHref } from "@/lib/authLinks";

const NAV_DASHBOARD = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/investment-plans", label: "Investments" },
  { href: "/history", label: "Transactions" },
  {
    href: "/dashboard#portfolio-growth",
    mobileHref: "/dashboard/growth",
    label: "Analytics",
  },
] as const;

/* ✅ UPDATED BRAND (FIXED DESIGN) — dashboard & desktop marketing */
function BrandLockup({ href }: { href: string }) {
  return (
    <Link href={href} className="flex h-12 items-center gap-2.5">
      <Image
        src="/logo.png"
        alt="Zuno"
        width={48}
        height={48}
        className="h-11 w-auto object-contain drop-shadow-[0_2px_8px_rgba(212,175,55,0.28)]"
        priority
      />
      <span className="text-[16px] font-semibold leading-none tracking-[0.25em] text-white">ZUNO</span>
    </Link>
  );
}

/** Compact lockup for marketing navbar below md only; desktop uses BrandLockup via responsive classes. */
function MarketingBrandLockup({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="flex h-9 shrink-0 items-center gap-1.5 md:h-12 md:gap-2.5"
    >
      <Image
        src="/logo.png"
        alt="Zuno"
        width={48}
        height={48}
        className="h-8 w-auto object-contain drop-shadow-[0_2px_8px_rgba(212,175,55,0.28)] md:h-11"
        priority
      />
      <span className="text-[13px] font-semibold leading-none tracking-[0.22em] text-white md:text-[16px] md:tracking-[0.25em]">
        ZUNO
      </span>
    </Link>
  );
}

function useRouteHash(): string {
  const [fragment, setFragment] = useState("");

  useEffect(() => {
    function sync() {
      setFragment(window.location.hash.replace(/^#/, "").toLowerCase());
    }
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return fragment;
}

/* ✅ UPDATED NAV LINK STYLE */
function NavLinkDash({
  href,
  label,
  pathname,
  fragment,
  onNavigate,
  linkClassName,
}: {
  href: string;
  label: string;
  pathname: string | null;
  fragment: string;
  onNavigate?: () => void;
  /** Override default text sizing (e.g. larger touch targets in mobile drawer). */
  linkClassName?: string;
}) {
  const [pathOnly] = href.split("#");
  const hashed = href.includes("#");
  const targetFragment =
    hashed && href.includes("#portfolio-growth") ? "portfolio-growth" : "";

  const onMainDashboard =
    pathname === "/dashboard" || pathname === "/dashboard/";

  let isActive = false;

  if (hashed && targetFragment) {
    isActive =
      onMainDashboard && fragment.toLowerCase() === targetFragment;
  } else if (pathOnly === "/dashboard") {
    isActive = onMainDashboard && !fragment;
  } else {
    isActive =
      pathname === pathOnly || Boolean(pathname?.startsWith(`${pathOnly}/`));
  }

  const tone = isActive
    ? "text-[#D4AF37]"
    : "text-[#E5E7EB]/90 hover:text-[#D4AF37]";

  const sizing =
    linkClassName ??
    "text-sm font-medium transition-colors duration-200";

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`${sizing} ${tone}`}
    >
      {label}
    </Link>
  );
}

function MarketingNavbarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  function closeMobile() {
    setMobileOpen(false);
  }

  const loginUrl = loginHref(nextParam);
  const signupUrl = signupHref(nextParam);

  return (
    <>
      <header className="navbar-glass sticky top-0 z-[200] pt-[env(safe-area-inset-top)]">
        <nav className="mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-3 md:h-[88px] md:gap-4 md:px-8">
          <button
            type="button"
            className="-ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#E5E7EB] transition hover:bg-white/5 md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="marketing-mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <MarketingBrandLockup href="/" />

          <div className="min-w-0 flex-1 md:hidden" aria-hidden />

          <div className="hidden lg:flex lg:flex-1 lg:justify-center">
            <div className="flex items-center gap-10 text-[14px] font-medium text-[#E5E7EB]/90">
              <a href="#home" className="group relative py-1 transition hover:text-[#D4AF37]">
                Home
                <span className="pointer-events-none absolute -bottom-1 left-1/2 h-px w-0 -translate-x-1/2 bg-[#D4AF37] transition-all duration-300 group-hover:w-full" />
              </a>
              <Link href={signupUrl} className="group relative py-1 transition hover:text-[#D4AF37]">
                Marketplace
                <span className="pointer-events-none absolute -bottom-1 left-1/2 h-px w-0 -translate-x-1/2 bg-[#D4AF37] transition-all duration-300 group-hover:w-full" />
              </Link>
              <a href="#plans" className="group relative py-1 transition hover:text-[#D4AF37]">
                Investment Plans
                <span className="pointer-events-none absolute -bottom-1 left-1/2 h-px w-0 -translate-x-1/2 bg-[#D4AF37] transition-all duration-300 group-hover:w-full" />
              </a>
              <a href="#how-it-works" className="group relative py-1 transition hover:text-[#D4AF37]">
                How it Works
                <span className="pointer-events-none absolute -bottom-1 left-1/2 h-px w-0 -translate-x-1/2 bg-[#D4AF37] transition-all duration-300 group-hover:w-full" />
              </a>
              <Link href="/merchant-requirements" className="group relative py-1 transition hover:text-[#D4AF37]">
                Merchant Program
                <span className="pointer-events-none absolute -bottom-1 left-1/2 h-px w-0 -translate-x-1/2 bg-[#D4AF37] transition-all duration-300 group-hover:w-full" />
              </Link>
              <a href="#about" className="group relative py-1 transition hover:text-[#D4AF37]">
                About Us
                <span className="pointer-events-none absolute -bottom-1 left-1/2 h-px w-0 -translate-x-1/2 bg-[#D4AF37] transition-all duration-300 group-hover:w-full" />
              </a>
              <Link href="/contact" className="group relative py-1 transition hover:text-[#D4AF37]">
                Support
                <span className="pointer-events-none absolute -bottom-1 left-1/2 h-px w-0 -translate-x-1/2 bg-[#D4AF37] transition-all duration-300 group-hover:w-full" />
              </Link>
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
            <Link
              href="/contact"
              className="hidden lg:flex items-center gap-2 text-[15px] font-medium text-[#F5E6B3]/90"
            >
              <Headset size={16} />
              Support
            </Link>

            <Link
              href={loginUrl}
              className="hidden sm:block text-sm text-[#E5E7EB]/90 transition hover:text-[#D4AF37]"
            >
              Log In
            </Link>

            <Link
              href={signupUrl}
              className="flex items-center gap-1 rounded-md bg-[linear-gradient(135deg,#F7E3A0_0%,#D4AF37_50%,#EAC54F_100%)] px-2.5 py-1.5 text-xs font-semibold text-black shadow-[0_0_12px_rgba(212,175,55,0.22)] transition duration-200 md:gap-2 md:rounded-lg md:px-4 md:py-2 md:text-sm md:shadow-[0_0_25px_rgba(212,175,55,0.35)] md:hover:-translate-y-[1px]"
            >
              <span className="whitespace-nowrap">Join Us</span>
              <ArrowRight size={16} className="hidden shrink-0 md:block" aria-hidden />
            </Link>
          </div>
        </nav>
      </header>

      {mobileOpen ? (
        <div
          id="marketing-mobile-nav"
          className="surface-menu-mobile fixed inset-0 z-[210] flex flex-col pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))] px-6 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10">
            <BrandLockup href="/" />
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-[#E5E7EB] hover:bg-white/5"
              aria-label="Close menu"
              onClick={closeMobile}
            >
              <X size={22} />
            </button>
          </div>

          <nav className="mt-6 flex flex-col gap-1 text-[15px] font-medium">
            <a
              href="#home"
              className="rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={closeMobile}
            >
              Home
            </a>
            <Link
              href={signupUrl}
              className="rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={closeMobile}
            >
              Marketplace
            </Link>
            <a
              href="#plans"
              className="rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={closeMobile}
            >
              Investment Plans
            </a>
            <a
              href="#how-it-works"
              className="rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={closeMobile}
            >
              How it Works
            </a>
            <Link
              href="/merchant-requirements"
              className="rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={closeMobile}
            >
              Merchant Program
            </Link>
            <a
              href="#about"
              className="rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={closeMobile}
            >
              About Us
            </a>
            <Link
              href="/contact"
              className="rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={closeMobile}
            >
              Support
            </Link>
          </nav>

          <div className="mt-auto flex flex-col gap-3 pt-6">
            <Link
              href={loginUrl}
              onClick={closeMobile}
              className="flex h-12 items-center justify-center rounded-xl border border-white/15 text-base font-semibold text-[#E5E7EB] transition hover:border-[#D4AF37]/60 hover:text-[#D4AF37]"
            >
              Login
            </Link>
            <Link
              href={signupUrl}
              onClick={closeMobile}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#D4AF37] text-base font-semibold text-black transition hover:opacity-90 hover:shadow-[0_0_22px_rgba(212,175,55,0.45)]"
            >
              Join Us
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function MarketingNavbar() {
  return (
    <Suspense
      fallback={
        <header className="navbar-glass sticky top-0 z-[200] h-14 md:h-[88px]" />
      }
    >
      <MarketingNavbarInner />
    </Suspense>
  );
}

export function DashboardNavbar({
  avatarUrl,
  unreadNotificationCount = 0,
  avatarBroken,
  onAvatarError,
}: {
  avatarUrl?: string | null;
  unreadNotificationCount?: number;
  avatarBroken?: boolean;
  onAvatarError?: () => void;
}) {
  const pathname = usePathname();
  const fragment = useRouteHash();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <>
      <header className="surface-panel sticky top-0 z-[200] w-full border-b border-white/5 bg-black/80 pt-[env(safe-area-inset-top)] lg:backdrop-blur-xl">
        <nav className="flex min-h-[70px] items-center gap-2 px-4 md:gap-4 md:px-10">
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#E5E7EB] transition hover:bg-white/5 md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="dashboard-mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div className="flex min-w-0 flex-1 justify-center md:flex-none md:justify-start">
            <BrandLockup href="/dashboard" />
          </div>

          <div className="hidden flex-1 justify-center gap-10 md:flex">
            {NAV_DASHBOARD.map((item) => (
              <NavLinkDash
                key={item.href}
                href={item.href}
                label={item.label}
                pathname={pathname}
                fragment={fragment}
              />
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2 md:gap-5">
            <Link
              href="/notifications"
              className="rounded-lg p-2.5 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              aria-label="Notifications"
            >
              <Bell size={22} />
            </Link>

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-700">
              <UserRound size={18} className="text-[#D4AF37]" />
            </div>

            <Link
              href="/deposit"
              className="rounded-lg bg-[#D4AF37] px-3 py-2 text-xs font-semibold text-black transition hover:opacity-90 hover:shadow-[0_0_22px_rgba(212,175,55,0.45)] sm:px-4 sm:text-sm"
            >
              Deposit
            </Link>
          </div>
        </nav>
      </header>

      {mobileOpen ? (
        <div
          id="dashboard-mobile-nav"
          className="surface-menu-mobile fixed inset-0 z-[210] flex flex-col pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))] px-6 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Dashboard navigation"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10">
            <BrandLockup href="/dashboard" />
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-[#E5E7EB] hover:bg-white/5"
              aria-label="Close menu"
              onClick={closeMobile}
            >
              <X size={22} />
            </button>
          </div>

          <nav className="mt-8 flex flex-col gap-1">
            {NAV_DASHBOARD.map((item) => (
              <NavLinkDash
                key={item.href}
                href={"mobileHref" in item && item.mobileHref ? item.mobileHref : item.href}
                label={item.label}
                pathname={pathname}
                fragment={fragment}
                onNavigate={closeMobile}
                linkClassName="block rounded-xl px-4 py-4 text-base font-medium transition-colors duration-200 hover:bg-white/5"
              />
            ))}
          </nav>
        </div>
      ) : null}
    </>
  );
}

export default DashboardNavbar;