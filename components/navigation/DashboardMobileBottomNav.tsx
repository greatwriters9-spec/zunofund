"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutList, ScrollText, User, Wallet } from "lucide-react";

const NAV_ITEMS = [
  {
    label: "Home",
    href: "/dashboard",
    icon: Home,
    activeMatch: (path: string) => path === "/dashboard" || path === "/dashboard/",
  },
  {
    label: "P2P",
    href: "/p2p",
    icon: LayoutList,
    activeMatch: (path: string) => path.startsWith("/p2p"),
  },
  {
    label: "Orders",
    href: "/history",
    icon: ScrollText,
    activeMatch: (path: string) => path.startsWith("/history"),
  },
  {
    label: "Wallet",
    href: "/dashboard/balance",
    icon: Wallet,
    activeMatch: (path: string) =>
      path.startsWith("/dashboard/balance") ||
      path.startsWith("/deposit") ||
      path.startsWith("/withdraw"),
  },
  {
    label: "Profile",
    href: "/dashboard/profile",
    icon: User,
    activeMatch: (path: string) => path.startsWith("/dashboard/profile"),
  },
] as const;

export function DashboardMobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[195] border-t border-white/[0.06] bg-[rgba(5,7,13,0.95)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-5 items-stretch px-0.5 pt-1">
        {NAV_ITEMS.map(({ label, href, icon: Icon, activeMatch }) => {
          const isActive = activeMatch(pathname ?? "/");

          return (
            <Link
              key={label}
              href={href}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-2 transition ${
                isActive ? "text-[#D4AF37]" : "text-[#8A93A5]"
              }`}
            >
              <Icon
                className={`h-[17px] w-[17px] shrink-0 ${isActive ? "drop-shadow-[0_0_8px_rgba(212,175,55,0.45)]" : ""}`}
                aria-hidden
              />
              <span
                className={`w-full truncate text-center text-[9px] leading-tight font-medium ${
                  isActive ? "text-[#F5E6B3]" : ""
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
