"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Bell, Headset, Menu, UserRound, X } from "lucide-react";

const NAV_DASHBOARD = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/investment-plans", label: "Investments" },
  { href: "/history", label: "Transactions" },
  { href: "/dashboard#portfolio-growth", label: "Analytics" },
] as const;

/* ✅ UPDATED BRAND (FIXED DESIGN) */
function BrandLockup({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 h-10">
      <Image
        src="/logo.png"
        alt="Zuno"
        width={40}
        height={40}
        className="h-9 w-auto object-contain drop-shadow-[0_2px_6px_rgba(212,175,55,0.25)]"
        priority
      />
      <span className="text-white text-[16px] font-semibold tracking-[0.25em] leading-none">
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

export function MarketingNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-[200] border-b border-white/5 bg-black/80 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
        <nav className="mx-auto flex h-[80px] max-w-[1600px] items-center gap-4 px-4 md:px-8">
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#E5E7EB] transition hover:bg-white/5 md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="marketing-mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <BrandLockup href="/" />

          <div className="hidden md:flex md:flex-1 md:justify-center">
            <div className="flex items-center gap-10 text-[15px] font-medium text-[#E5E7EB]/90">
              <a href="#home" className="hover:text-[#D4AF37] transition font-medium">
                Home
              </a>
              <a href="#plans" className="hover:text-[#D4AF37] transition">
                Investment Plans
              </a>
              <a href="#how-it-works" className="hover:text-[#D4AF37] transition">
                How It Works
              </a>
              <Link href="/contact" className="hover:text-[#D4AF37] transition">
                Support
              </Link>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/contact"
              className="hidden lg:flex items-center gap-2 text-[15px] font-medium text-[#F5E6B3]/90"
            >
              <Headset size={16} />
              Support
            </Link>

            <Link href="/auth" className="hidden sm:block text-sm text-[#E5E7EB]/90 hover:text-[#D4AF37]">
              Login
            </Link>

            <Link
              href="/investment-plans"
              className="flex items-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black hover:opacity-90 hover:shadow-[0_0_22px_rgba(212,175,55,0.45)] transition"
            >
              Start
              <ArrowRight size={16} />
            </Link>
          </div>
        </nav>
      </header>

      {mobileOpen ? (
        <div
          id="marketing-mobile-nav"
          className="fixed inset-0 z-[210] flex flex-col bg-[#05080F]/97 backdrop-blur-xl pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))] px-6 md:hidden"
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

          <nav className="mt-8 flex flex-col gap-1 text-[15px] font-medium">
            <a
              href="#home"
              className="rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={closeMobile}
            >
              Home
            </a>
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
              How It Works
            </a>
            <Link
              href="/contact"
              className="rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={closeMobile}
            >
              Support
            </Link>
            <Link
              href="/auth"
              className="rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={closeMobile}
            >
              Login
            </Link>
          </nav>
        </div>
      ) : null}
    </>
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
      <header className="sticky top-0 z-[200] w-full border-b border-white/5 bg-black/80 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
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
                {...item}
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
          className="fixed inset-0 z-[210] flex flex-col bg-[#05080F]/97 backdrop-blur-xl pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))] px-6 md:hidden"
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
                {...item}
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