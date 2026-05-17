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
}: {
  href: string;
  label: string;
  pathname: string | null;
  fragment: string;
  onNavigate?: () => void;
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

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`text-sm font-medium transition-colors duration-200 ${
        isActive
          ? "text-[#D4AF37]"
          : "text-[#E5E7EB]/90 hover:text-[#D4AF37]"
      }`}
    >
      {label}
    </Link>
  );
}

export function MarketingNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <>
      <header className="sticky top-0 z-[200] border-b border-white/5 bg-black/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-[80px] max-w-[1600px] items-center gap-4 px-4 md:px-8">
          
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center text-[#E5E7EB] md:hidden"
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <BrandLockup href="/" />

          <div className="hidden md:flex md:flex-1 md:justify-center">
            <div className="flex items-center gap-10 text-[15px] font-medium text-[#E5E7EB]/90">
            <a href="#home" className="hover:text-[#D4AF37] transition font-medium">Home</a>
              <a href="#plans" className="hover:text-[#D4AF37] transition">Investment Plans</a>
              <a href="#how-it-works" className="hover:text-[#D4AF37] transition">How It Works</a>
              <Link href="/contact" className="hover:text-[#D4AF37] transition">Support</Link>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <Link href="/contact" className="hidden lg:flex items-center gap-2 text-[15px] font-medium text-[#F5E6B3]/90">
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
    </>
  );
}

export function DashboardNavbar({
  avatarUrl,
  unreadNotificationCount = 0,
  avatarBroken,
  onAvatarError,
}: any) {
  const pathname = usePathname();
  const fragment = useRouteHash();

  return (
    <header className="sticky top-0 z-[200] w-full border-b border-white/5 bg-black/80 backdrop-blur-xl">
      <nav className="grid h-[70px] grid-cols-[1fr_auto_1fr] items-center px-6 md:px-10">
        
        <div className="flex items-center">
          <BrandLockup href="/dashboard" />
        </div>

        <div className="hidden md:flex items-center justify-center gap-10">
          {NAV_DASHBOARD.map((item) => (
            <NavLinkDash
              key={item.href}
              {...item}
              pathname={pathname}
              fragment={fragment}
            />
          ))}
        </div>

        <div className="flex items-center justify-end gap-5">
          
          <Link href="/notifications" className="text-[#E5E7EB]/90 hover:text-[#D4AF37] transition">
            <Bell size={22} />
          </Link>

          <div className="h-9 w-9 rounded-full bg-gray-700 flex items-center justify-center">
            <UserRound size={18} className="text-[#D4AF37]" />
          </div>

          <Link
            href="/deposit"
            className="rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black hover:opacity-90 hover:shadow-[0_0_22px_rgba(212,175,55,0.45)] transition"
          >
            Deposit
          </Link>

        </div>
      </nav>
    </header>
  );
}

export default DashboardNavbar;