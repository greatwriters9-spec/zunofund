import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BarChart3,
  Gift,
  Headset,
  History,
  LayoutDashboard,
  LineChart,
  Star,
  UserRound,
  Wallet,
} from "lucide-react";

export type InvestorNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match pathname prefix (e.g. /dashboard/balance matches Assets) */
  matchPrefix?: string;
};

export const INVESTOR_SIDEBAR_NAV: InvestorNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, matchPrefix: "/dashboard" },
  { href: "/dashboard/balance", label: "Assets", icon: Wallet, matchPrefix: "/dashboard/balance" },
  { href: "/history", label: "Orders", icon: History, matchPrefix: "/history" },
  { href: "/rewards", label: "Rewards Hub", icon: Gift, matchPrefix: "/rewards" },
  { href: "/investment-plans", label: "Plans", icon: Star, matchPrefix: "/investment-plans" },
  { href: "/p2p", label: "P2P", icon: ArrowLeftRight, matchPrefix: "/p2p" },
  { href: "/markets", label: "Markets", icon: LineChart, matchPrefix: "/markets" },
  {
    href: "/dashboard#portfolio-growth",
    label: "Analytics",
    icon: BarChart3,
    matchPrefix: "/dashboard/growth",
  },
  { href: "/support", label: "Support", icon: Headset, matchPrefix: "/support" },
  { href: "/dashboard/profile", label: "Account", icon: UserRound, matchPrefix: "/dashboard/profile" },
];

export const INVESTOR_TOP_NAV = [
  { href: "/markets", label: "Markets" },
  { href: "/p2p", label: "P2P" },
  { href: "/investment-plans", label: "Plans" },
  { href: "/history", label: "Orders" },
] as const;

export function isInvestorNavActive(pathname: string, item: InvestorNavItem): boolean {
  if (item.href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/dashboard/";
  }
  const prefix = item.matchPrefix ?? item.href.split("#")[0];
  if (prefix === "/dashboard") return false;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
