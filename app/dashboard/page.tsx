"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Menu } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import {
  Bell,
  Eye,
  EyeOff,
  Wallet,
  BarChart3,
  Headset,
  ArrowRight,
  UserRound,
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import { coerceRpcBigint, formatSupabaseError, useSupabase } from "@/lib/supabase";
import {
  dailyCompoundLabel,
  displayPlanName,
  normalizeInvestmentPlan,
} from "@/lib/investmentPlans";
import { fetchInvestorNotificationSnapshot } from "@/lib/dashboardInvestorAlerts";
import { notificationsOwnerOrFilter } from "@/lib/notificationQuery";

interface Investor {
  id: string;
  full_name: string;
  first_name?: string | null;
  email: string;
  avatar_url?: string | null;
  balance: number;
  total_profit: number;
  investment_plan: string;
  status: string;
  withdrawable_balance?: number | null;
  locked_principal_balance?: number | null;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface Activity {
  id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
}

interface ProfitChartData {
  id: number;
  date: string;
  profit: number;
}

export default function DashboardPage() {
  const supabase = useSupabase();

  const [investor, setInvestor] = useState<Investor | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [activities, setActivities] = useState<Activity[]>([]);

  const [chartData, setChartData] = useState<ProfitChartData[]>([]);

  const [showBalance, setShowBalance] = useState(true);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      try {
        localStorage.clear();
      } catch {
        /* ignore — private browsing or unavailable storage */
      }
      window.location.href = "/";
    }
  }

  const [showNotifications, setShowNotifications] = useState(false);

  const [showWalletModal, setShowWalletModal] = useState(false)

  const [loading, setLoading] = useState(true);
  const [profileAvatarBroken, setProfileAvatarBroken] = useState(false);
  /** Global crypto market cap (USD), CoinGecko — informational only. */
  const [globalMarketCapUsd, setGlobalMarketCapUsd] = useState<number | null>(
    null,
  );
  const balance = Number(investor?.balance || 0);
  const withdrawable = Number(investor?.withdrawable_balance ?? balance);
  const lockedPrincipal = Number(investor?.locked_principal_balance ?? 0);
  const planKey = normalizeInvestmentPlan(investor?.investment_plan);

  const router = useRouter();
  const pathname = usePathname();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => setMobileNavOpen(false), [pathname]);

  const syncInvestorAlerts = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return;

    const next = await fetchInvestorNotificationSnapshot(
      supabase,
      user.id,
      user.email.trim(),
    );
    setNotifications(next.preview as Notification[]);
    setUnreadNotificationCount(next.unreadTotal);
  }, [supabase]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    fetch("https://api.coingecko.com/api/v3/global", {
      signal: ac.signal,
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((payload: { data?: { total_market_cap?: { usd?: number } } }) => {
        const v = payload?.data?.total_market_cap?.usd;
        if (!cancelled && typeof v === "number") setGlobalMarketCapUsd(v);
      })
      .catch(() => {
        if (!cancelled) setGlobalMarketCapUsd(null);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  async function fetchDashboardData() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email || !user.id) {
      setLoading(false);
      return;
    }

    const { data: investorData } = await supabase
  .from("investors")
  .select("*")
  .eq("user_id", user.id)
  .single();

    setInvestor(investorData);

    const snap = await fetchInvestorNotificationSnapshot(
      supabase,
      user.id,
      user.email.trim(),
    );
    setNotifications(snap.preview as Notification[]);
    setUnreadNotificationCount(snap.unreadTotal);

    const { data: deposits } = await supabase
      .from("deposits")
      .select("id, amount, status, created_at")
      .eq("user_id", user.id);

    const { data: withdrawals } = await supabase
      .from("withdrawals")
      .select("id, amount, status, created_at")
      .eq("user_id", user.id);

    const profitOwner = notificationsOwnerOrFilter({
      userId: user.id,
      investorEmail: user.email.trim(),
    });

    const { data: profitsRaw } = await supabase
      .from("profits")
      .select("*")
      .or(profitOwner)
      .order("created_at", { ascending: true });

    const profitsChronoAsc = [...(profitsRaw ?? [])];

    const profitsDesc = [...profitsChronoAsc].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const formattedProfits = profitsDesc.map((item) => ({
      id: item.id,
      type: "profit" as const,
      amount: Number(item.amount),
      status: item.status,
      created_at: item.created_at,
    }));

    const formattedDeposits = (deposits || []).map((item) => ({
      id: item.id,
      type: "deposit",
      amount: Number(item.amount),
      status: item.status,
      created_at: item.created_at,
    }));

    const formattedWithdrawals = (withdrawals || []).map((item) => ({
      id: item.id,
      type: "withdrawal",
      amount: Number(item.amount),
      status: item.status,
      created_at: item.created_at,
    }));

    const mergedActivities = [
      ...formattedDeposits,
      ...formattedWithdrawals,
      ...formattedProfits,
    ]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      )
      .slice(0, 3);

    setActivities(mergedActivities);

    let cumulativeProfit = 0;

    const growthData = profitsChronoAsc.map((profit, index) => {
      cumulativeProfit += Number(profit.amount);

      return {
        id: index + 1,
        date: new Date(profit.created_at).toLocaleDateString(),
        profit: cumulativeProfit,
      };
    });

    setChartData(growthData);

    setLoading(false);
  }

  useEffect(() => {
    const onRealtimeOrInsert = () => {
      void syncInvestorAlerts();
    };
    window.addEventListener("tp:investor-notification", onRealtimeOrInsert);
    window.addEventListener("tp:investor-notifications-sync", onRealtimeOrInsert);
    return () => {
      window.removeEventListener(
        "tp:investor-notification",
        onRealtimeOrInsert,
      );
      window.removeEventListener(
        "tp:investor-notifications-sync",
        onRealtimeOrInsert,
      );
    };
  }, [syncInvestorAlerts]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void syncInvestorAlerts();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [syncInvestorAlerts]);

  useEffect(() => {
    setProfileAvatarBroken(false);
  }, [investor?.avatar_url]);

  async function markNotificationAsRead(id: string) {
    const { error, data } = await supabase.rpc(
      "mark_investor_notifications_read",
      { p_ids: [id] },
    );

    if (error) {
      console.error("mark notification read:", formatSupabaseError(error));
      return;
    }

    const updated = coerceRpcBigint(data);
    if (updated < 1) {
      // Already read or stale id — reconcile badge counts from truth
      await syncInvestorAlerts();
      return;
    }

    await syncInvestorAlerts();
  }

  function getGreeting() {
    const hour = new Date().getHours();

    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";

    return "Good Evening";
  }

  function formatGreetingFirstName(segment: string): string {
    const t = segment.trim();
    if (!t) return "Investor…";
    const lower = t.toLocaleLowerCase();
    const first = lower.charAt(0).toLocaleUpperCase();
    return `${first}${lower.slice(1)}…`;
  }

  function investorGreetingName(inv: Investor | null): string {
    const fromColumn = inv?.first_name?.trim();
    if (fromColumn) return formatGreetingFirstName(fromColumn);

    const full = inv?.full_name?.trim();
    if (!full) return formatGreetingFirstName("investor");

    const firstWord = full.split(/\s+/).find(Boolean);
    return formatGreetingFirstName(firstWord ?? "");
  }

  function walletMoneyLabel(value: number): string {
    if (!showBalance) return "••••••";
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatBalanceUsdt(value: number): string {
    if (!showBalance) return "••••••";
    const maxFrac = value > 0 && value < 1 ? 6 : 2;
    return `${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: maxFrac,
    })} USDT`;
  }

  function formatBalanceUsdLine(value: number): string {
    if (!showBalance) return "••••••";
    return `≈ ${value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatMarketCapUsd(value: number): string {
    if (value >= 1e12)
      return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white text-xl">
        Loading Dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto p-5 md:p-7">

        {/* Mobile top toolbar: menu hard-left, profile+bell hard-right */}
        <div className="mb-5 flex items-center justify-between gap-2 md:hidden">
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/70 backdrop-blur-xl transition hover:border-yellow-500"
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMobileNavOpen((o) => !o)}
          >
            {mobileNavOpen ? (
              <X size={22} className="text-yellow-500" aria-hidden />
            ) : (
              <Menu size={22} className="text-yellow-500" aria-hidden />
            )}
          </button>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/dashboard/profile"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/70 backdrop-blur-xl transition hover:border-yellow-500"
              aria-label="Profile and security"
            >
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-yellow-500/25 bg-yellow-500/10">
                {investor?.avatar_url && !profileAvatarBroken ? (
                  <Image
                    src={investor.avatar_url}
                    alt=""
                    fill
                    sizes="32px"
                    className="object-cover"
                    onError={() => setProfileAvatarBroken(true)}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <UserRound className="text-yellow-500" size={18} aria-hidden />
                  </span>
                )}
              </div>
            </Link>

            <Link
              href="/notifications"
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/70 backdrop-blur-xl transition hover:border-yellow-500"
              aria-label="Notifications"
            >
              <Bell className="text-yellow-500" size={20} aria-hidden />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Header (greeting + desktop action cluster) */}
        <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-yellow-500 mb-2">
              {getGreeting()}, {investorGreetingName(investor)}
            </h1>

            <p className="text-gray-400">
              Welcome back.
            </p>
          </div>

          <div className="hidden shrink-0 items-center gap-3 md:flex">
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-2.5 text-sm font-medium text-zinc-400 transition hover:border-red-500/50 hover:text-red-400"
            >
              Logout
            </button>
            <Link
              href="/dashboard/profile"
              className="bg-zinc-950/70 backdrop-blur-xl border border-zinc-800 hover:border-yellow-500 transition p-3 rounded-2xl"
              aria-label="Profile and security"
            >
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-yellow-500/25 bg-yellow-500/10">
                {investor?.avatar_url && !profileAvatarBroken ? (
                  <Image
                    src={investor.avatar_url}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                    onError={() => setProfileAvatarBroken(true)}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <UserRound className="text-yellow-500" size={22} aria-hidden />
                  </span>
                )}
              </div>
            </Link>

            <div className="relative">

            <button
              onClick={() =>
                setShowNotifications(!showNotifications)
              }
              className="bg-zinc-950/70 backdrop-blur-xl border border-zinc-800 hover:border-yellow-500 transition p-4 rounded-2xl relative"
            >
              <Bell className="text-yellow-500" size={24} />

              {unreadNotificationCount > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </div>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-4 z-50 w-[min(360px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] bg-zinc-950/70 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">

                <div className="p-5 border-b border-zinc-800">
                  <h2 className="text-xl font-bold">
                    Notifications
                  </h2>
                </div>

                <div className="max-h-[420px] overflow-y-auto">

                  {notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() =>
                          markNotificationAsRead(notification.id)
                        }
                        className="w-full text-left p-5 border-b border-zinc-800 transition hover:bg-zinc-900"
                      >
                        <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                          {notification.title}
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-yellow-500"
                            aria-hidden
                          />
                        </h3>

                        <p className="text-gray-400 text-sm mb-2">
                          {notification.message}
                        </p>

                        <p className="text-gray-600 text-xs">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                      </button>
                    ))
                  ) : (
                    <div className="p-10 text-center text-gray-500">
                      No notifications.
                    </div>
                  )}
                </div>

                <div className="border-t border-zinc-800 p-4 flex justify-between items-center gap-3">
                  <p className="text-xs text-zinc-500">
                    {unreadNotificationCount > 0
                      ? `${unreadNotificationCount} unread`
                      : "No notifications."}
                  </p>
                  <Link
                    href="/notifications"
                    className="text-sm font-medium text-yellow-500 hover:text-yellow-400"
                  >
                    Open inbox →
                  </Link>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 border-b border-zinc-800/90 pb-8"
        >
          <p className="text-sm font-medium text-zinc-500">Total balance</p>

          <div className="mt-2 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-4xl font-bold tabular-nums tracking-tight text-white sm:text-5xl md:text-[3.25rem]">
                {formatBalanceUsdt(balance)}
              </p>
              <p className="mt-2 text-base tabular-nums text-zinc-500">
                {formatBalanceUsdLine(balance)}
              </p>
              <p className="mt-4 text-xs text-zinc-600">
                Global crypto market cap{" "}
                <span className="font-medium text-zinc-400">
                  {globalMarketCapUsd != null
                    ? formatMarketCapUsd(globalMarketCapUsd)
                    : "—"}
                </span>
                <span className="text-zinc-600"> · CoinGecko</span>
              </p>
              <div
                className={`mt-4 inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${
                  (investor?.status ?? "").toLowerCase() === "active"
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/25 bg-amber-500/10 text-amber-300"
                }`}
              >
                Account {(investor?.status ?? "unknown").toUpperCase()}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowBalance(!showBalance)}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-zinc-700/80 bg-transparent px-3 py-2 text-sm text-zinc-300 transition hover:border-yellow-500/50 hover:text-white sm:mt-1"
              aria-pressed={showBalance}
              aria-label={showBalance ? "Hide balance" : "Show balance"}
            >
              {showBalance ? (
                <EyeOff size={18} aria-hidden />
              ) : (
                <Eye size={18} aria-hidden />
              )}
              <span className="hidden min-[380px]:inline">
                {showBalance ? "Hide" : "Show"}
              </span>
            </button>
          </div>
        </motion.div>

        <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 lg:gap-4 items-stretch">


    {/* WALLET — minimal */}
<div className="flex flex-col border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5 lg:rounded-xl">

  <div className="mb-3 flex items-start justify-between gap-2">
    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
      Portfolio
    </p>
    <Wallet className="h-4 w-4 shrink-0 text-yellow-500/80" aria-hidden />
  </div>

  <p className="text-lg font-bold tabular-nums text-white sm:text-xl">
    {showBalance ? `$${balance.toLocaleString()}` : "••••"}
  </p>
  <p className="mt-1 text-[11px] leading-snug text-emerald-400/90">
    Withdrawable {showBalance ? `$${withdrawable.toFixed(2)}` : "••••"}
  </p>
  <p className="text-[11px] leading-snug text-zinc-500">
    Locked {showBalance ? `$${lockedPrincipal.toFixed(2)}` : "••••"}
  </p>

  <p className="mt-3 line-clamp-2 text-[11px] leading-snug text-zinc-600">
    Deposits plus compounded gains. Withdrawals use withdrawable funds;
    principal unlocks after 30 days.
  </p>

  <button
    type="button"
    onClick={() => setShowWalletModal(true)}
    className="mt-auto flex items-center justify-center gap-1.5 border border-zinc-700/90 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-yellow-500/40 hover:text-white lg:rounded-lg"
  >
    Wallet
    <ArrowRight size={14} aria-hidden />
  </button>
</div>


{/* PROFIT — minimal */}
<div className="flex flex-col border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5 lg:rounded-xl">

  <div className="mb-3 flex items-start justify-between gap-2">
    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
      Profits
    </p>
    <BarChart3 className="h-4 w-4 shrink-0 text-emerald-400/80" aria-hidden />
  </div>

  <p className="text-lg font-bold tabular-nums text-emerald-400 sm:text-xl">
    ${Number(investor?.total_profit || 0).toFixed(2)}
  </p>
  <p className="mt-2 text-[11px] leading-snug text-zinc-600">
    Cumulative earnings from daily ROI.
  </p>

  <Link
    href="/history"
    className="mt-auto flex items-center justify-center gap-1.5 border border-zinc-700/90 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-yellow-500/40 hover:text-white lg:rounded-lg"
  >
    History
    <ArrowRight size={14} aria-hidden />
  </Link>
</div>


  {/* PLAN — minimal */}
<div className="flex flex-col border border-yellow-500/15 bg-yellow-500/[0.03] p-4 sm:p-5 lg:rounded-xl">

  <div className="mb-3 flex items-start justify-between gap-2">
    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
      Plan
    </p>
    <span className="text-sm leading-none text-yellow-500/90" aria-hidden>
      ★
    </span>
  </div>

  <p className="line-clamp-2 text-base font-bold leading-tight text-yellow-500">
    {investor ? displayPlanName(planKey) : "No active plan"}
  </p>

  <div className="mt-3 space-y-1.5 text-[11px]">
    <div className="flex justify-between gap-2 text-zinc-500">
      <span>Capital</span>
      <span className="tabular-nums text-zinc-300">
        {showBalance ? `$${balance.toLocaleString()}` : "••••"}
      </span>
    </div>
    <div className="flex justify-between gap-2 text-zinc-500">
      <span>Daily target</span>
      <span className="text-right font-medium text-yellow-500/95">
        {investor ? dailyCompoundLabel(planKey) : "—"}
      </span>
    </div>
  </div>

  <Link
    href="/investment-plans"
    className="mt-auto flex items-center justify-center gap-1.5 border border-zinc-700/90 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-yellow-500/40 hover:text-white lg:rounded-lg"
  >
    Plans
    <ArrowRight size={14} aria-hidden />
  </Link>
</div>


{/* SUPPORT — minimal */}
<div className="flex flex-col border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5 lg:rounded-xl">

  <div className="mb-3 flex items-start justify-between gap-2">
    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
      Support
    </p>
    <Headset className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
  </div>

  <p className="text-base font-bold text-white">24/7</p>
  <div className="mt-2 space-y-0.5 text-[11px] text-zinc-500">
    <p className="truncate">support@zunofund.com</p>
    <p>+254 797 674 560</p>
  </div>

<Link
  href="/support"
  className="mt-auto flex items-center justify-center gap-1.5 border border-zinc-700/90 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-yellow-500/40 hover:text-white lg:rounded-lg"
>
  Contact
  <ArrowRight size={14} aria-hidden />
</Link>
</div>
          
        </div>

        <div className="mb-7 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:snap-none md:grid-cols-2 md:gap-3 xl:grid-cols-4 xl:gap-4 md:overflow-visible md:pb-0">

          <Link
            href="/deposit"
            className="min-w-[calc(50%-4px)] shrink-0 snap-start rounded-xl bg-yellow-500 px-4 py-3 text-center text-sm font-bold text-black transition hover:bg-yellow-600 md:min-w-0"
          >
            Deposit
          </Link>

          <Link
            href="/withdraw"
            className="min-w-[calc(50%-4px)] shrink-0 snap-start rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-center text-sm font-semibold text-white transition hover:border-yellow-500/50 md:min-w-0"
          >
            Withdraw
          </Link>

          <Link
            href="/investment-plans"
            className="min-w-[calc(50%-4px)] shrink-0 snap-start rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-center text-sm font-semibold text-white transition hover:border-yellow-500/50 md:min-w-0"
          >
            Plans
          </Link>

          <Link
            href="/support"
            className="min-w-[calc(50%-4px)] shrink-0 snap-start rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-center text-sm font-semibold text-white transition hover:border-yellow-500/50 md:min-w-0"
          >
            Support
          </Link>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-7">

          <div id="portfolio-growth" className="xl:col-span-2 bg-zinc-950/70 backdrop-blur-xl border border-zinc-800 rounded-3xl p-5">

            <h2 className="text-2xl font-bold mb-1">
              Portfolio Growth
            </h2>

            <p className="text-gray-400 mb-6">
              Real growth based on actual profits.
            </p>

            <div className="w-full min-h-[260px] sm:min-h-[300px] md:min-h-[320px]" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient
                    id="profit"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#facc15"
                      stopOpacity={0.4}
                    />

                    <stop
                      offset="95%"
                      stopColor="#facc15"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#27272a"
                />

                <XAxis
                  dataKey="date"
                  stroke="#71717a"
                />

                <YAxis stroke="#71717a" />

                <Tooltip
                  contentStyle={{
                    backgroundColor: "#09090b",
                    border: "1px solid #27272a",
                    borderRadius: "16px",
                    color: "#fff",
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="profit"
                  stroke="#facc15"
                  fill="url(#profit)"
                  strokeWidth={4}
                />
              </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-zinc-950/70 backdrop-blur-xl border border-zinc-800 rounded-3xl p-5 flex flex-col max-h-[min(420px,55vh)]">

            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-2xl font-bold">
                Notifications
              </h2>

              <div className="flex items-center gap-3">
                <Link
                  href="/notifications"
                  className="text-yellow-500 hover:text-yellow-400 transition font-medium text-sm"
                >
                  View all
                </Link>
                <Bell className="text-yellow-500 shrink-0" size={22} />
              </div>
            </div>

            <div className="space-y-3 min-h-0 overflow-y-auto pr-1 -mr-1">

              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    className="w-full shrink-0 rounded-2xl border border-zinc-800 bg-black/40 p-3.5 text-left transition hover:border-yellow-500/30"
                    onClick={() => markNotificationAsRead(notification.id)}
                  >
                    <h3 className="font-semibold text-sm mb-1 text-white line-clamp-1">
                      {notification.title}
                    </h3>

                    <p className="text-gray-400 text-xs leading-snug line-clamp-2">
                      {notification.message}
                    </p>
                  </button>
                ))
              ) : (
                <div className="text-gray-500 text-center py-8 text-sm shrink-0">
                  No notifications.
                </div>
              )}
            </div>

          </div>
        </div>

        <div className="bg-zinc-950/70 backdrop-blur-xl border border-zinc-800 rounded-3xl overflow-hidden">

          <div className="p-5 border-b border-zinc-800 flex items-center justify-between">

  <h2 className="text-2xl font-bold">
    Recent Activities
  </h2>

  <Link
    href="/history"
    className="text-yellow-500 hover:text-yellow-400 transition font-medium text-sm"
  >
    View All
  </Link>
</div>

          <div className="divide-y divide-zinc-800">

            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between p-5"
              >
                <div>
                  <h3 className="font-semibold capitalize">
                    {activity.type}
                  </h3>

                  <p className="text-gray-500 text-sm">
                    {activity.status}
                  </p>
                </div>

                <div
                  className={`text-xl font-bold ${
                    activity.type === "withdrawal"
                      ? "text-red-500"
                      : "text-green-500"
                  }`}
                >
                  {activity.type === "withdrawal"
                    ? "-"
                    : "+"}
                  ${Number(activity.amount).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showWalletModal ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-5 bg-black/75 backdrop-blur-sm"
          role="presentation"
          onClick={() => setShowWalletModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-modal-title"
            className="relative w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950/70 backdrop-blur-xl p-6 shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowWalletModal(false)}
              className="absolute right-4 top-4 rounded-xl border border-zinc-800 p-2 text-zinc-400 hover:border-yellow-500/50 hover:text-yellow-500 transition"
              aria-label="Close wallet"
            >
              <X size={18} aria-hidden />
            </button>

            <div className="mb-6 flex items-start gap-4 pr-10">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-yellow-500/25 bg-yellow-500/10">
                <Wallet className="text-yellow-500" size={26} aria-hidden />
              </div>
              <div>
                <h2 id="wallet-modal-title" className="text-xl font-bold text-white">
                  Your wallet
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Balances available for withdrawal and locked principal. Totals follow your
                  dashboard privacy setting.
                </p>
              </div>
            </div>

            <dl className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
                <dt className="text-sm text-zinc-400">Withdrawable now</dt>
                <dd className="font-semibold text-emerald-400 tabular-nums">
                  {walletMoneyLabel(withdrawable)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-black/30 px-4 py-3">
                <dt className="text-sm text-zinc-400">Locked principal</dt>
                <dd className="font-semibold text-yellow-500/95 tabular-nums">
                  {walletMoneyLabel(lockedPrincipal)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-black/30 px-4 py-3">
                <dt className="text-sm text-zinc-400">Total profit</dt>
                <dd className="font-semibold text-green-400 tabular-nums">
                  {walletMoneyLabel(Number(investor?.total_profit || 0))}
                </dd>
              </div>
            </dl>

            <p className="mt-5 text-xs text-zinc-500 leading-relaxed">
              Withdrawals use withdrawable funds only. Principal from each deposit unlocks after the
              30-day holding period per the platform rules.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowWalletModal(false)}
                className="flex-1 rounded-2xl border border-zinc-700 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-600 transition"
              >
                Close
              </button>
              <Link
                href="/withdraw"
                onClick={() => setShowWalletModal(false)}
                className="flex flex-1 items-center justify-center rounded-2xl bg-yellow-500 py-3 text-sm font-bold text-black hover:bg-yellow-600 transition"
              >
                Withdraw
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {mobileNavOpen ? (
        <div
          className="fixed inset-0 z-[210] flex flex-col bg-[#05080F]/97 backdrop-blur-xl pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))] px-6 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Dashboard navigation"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10">
            <span className="text-lg font-semibold tracking-tight text-white">Menu</span>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-[#E5E7EB] hover:bg-white/5"
              aria-label="Close menu"
              onClick={() => setMobileNavOpen(false)}
            >
              <X size={22} aria-hidden />
            </button>
          </div>
          <nav className="mt-6 flex flex-col gap-1 text-[15px] font-medium">
            <Link
              href="/dashboard"
              className="rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/investment-plans"
              className="rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              Investments
            </Link>
            <Link
              href="/history"
              className="rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              Transactions
            </Link>
            <Link
              href="/dashboard#portfolio-growth"
              className="rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              Analytics
            </Link>
            <Link
              href="/dashboard/profile"
              className="rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              Profile & security
            </Link>
            <Link
              href="/deposit"
              className="rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              Deposit
            </Link>
            <Link
              href="/support"
              className="rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              Support
            </Link>
          </nav>

          <div className="mt-auto pt-6">
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                handleLogout();
              }}
              className="flex w-full items-center justify-center rounded-xl border border-red-500/40 bg-red-500/5 px-4 py-4 text-base font-semibold text-red-300 transition hover:border-red-500 hover:bg-red-500/10 hover:text-red-200"
            >
              Logout
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
