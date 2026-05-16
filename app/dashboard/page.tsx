"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Bitcoin } from "lucide-react"
import { useRouter } from "next/navigation"

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
  await supabase.auth.signOut()

  localStorage.clear()

  window.location.href = "/auth"
}

  const [showNotifications, setShowNotifications] = useState(false);

  const [showWalletModal, setShowWalletModal] = useState(false)

  const [loading, setLoading] = useState(true);
  const [profileAvatarBroken, setProfileAvatarBroken] = useState(false);
  const balance = Number(investor?.balance || 0);
  const withdrawable = Number(investor?.withdrawable_balance ?? balance);
  const lockedPrincipal = Number(investor?.locked_principal_balance ?? 0);
  const planKey = normalizeInvestmentPlan(investor?.investment_plan);

  const router = useRouter();

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

  async function fetchDashboardData() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email || !user.id) {
      setLoading(false);
      return;
    }

    async function handleLogout() {
  try {

    await supabase.auth.signOut()

    localStorage.clear()

    router.push("/auth")

  } catch (error) {
    console.log("Logout error:", error)
  }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white text-xl">
        Loading Dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">

      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-yellow-500/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-yellow-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto p-5 md:p-7">

        <div className="flex items-center justify-between mb-7">

          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-yellow-500 mb-2">
              {getGreeting()}, {investorGreetingName(investor)}
            </h1>

            <p className="text-gray-400">
              Welcome back.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/profile"
              className="bg-zinc-950 border border-zinc-800 hover:border-yellow-500 transition p-3 rounded-2xl"
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
              className="bg-zinc-950 border border-zinc-800 hover:border-yellow-500 transition p-4 rounded-2xl relative"
            >
              <Bell className="text-yellow-500" size={24} />

              {unreadNotificationCount > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </div>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-4 w-[360px] bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl z-50 overflow-hidden">

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
                        onClick={() =>
                          notification.is_read === true
                            ? undefined
                            : markNotificationAsRead(notification.id)
                        }
                        disabled={notification.is_read === true}
                        className={`w-full text-left p-5 border-b border-zinc-800 hover:bg-zinc-900 transition ${
                          notification.is_read === true
                            ? "opacity-60 cursor-default hover:bg-transparent"
                            : ""
                        }`}
                      >
                        <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                          {notification.title}
                          {notification.is_read !== true ? (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-yellow-500" aria-hidden />
                          ) : (
                            <span className="text-xs font-normal text-zinc-500">
                              Read
                            </span>
                          )}
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
                      No notifications in recent activity.
                    </div>
                  )}
                </div>

                <div className="border-t border-zinc-800 p-4 flex justify-between items-center gap-3">
                  <p className="text-xs text-zinc-500">
                    {unreadNotificationCount > 0
                      ? `${unreadNotificationCount} unread total`
                      : "You're up to date"}
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-gradient-to-br from-yellow-500/15 to-yellow-500/5 border border-yellow-500/20 rounded-[28px] p-6 mb-7"
        >
          <div className="relative z-10">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
  <svg
    viewBox="0 0 1200 400"
    className="absolute right-[-100px] top-[-40px] w-[900px] h-[400px] opacity-10"
    fill="none"
  >
    <path
      d="M0 320 C150 260 250 300 380 220 C500 150 620 190 760 120 C900 60 1040 100 1200 20"
      stroke="url(#goldGradient)"
      strokeWidth="6"
      strokeLinecap="round"
    />

    <defs>
      <linearGradient
        id="goldGradient"
        x1="0"
        y1="0"
        x2="1200"
        y2="0"
      >
        <stop offset="0%" stopColor="#facc15" />
        <stop offset="100%" stopColor="#eab308" />
      </linearGradient>
    </defs>
  </svg>
</div>

            <p className="text-gray-300 text-lg mb-3">
              Total Balance
            </p>

            <h2 className="text-5xl font-bold text-white mb-5">
              {showBalance
                ? `$${Number(investor?.balance || 0).toFixed(2)}`
                : "••••••"}
            </h2>

            <div className="flex items-center gap-4 flex-wrap">
                <button
    onClick={handleLogout}
    className="flex items-center gap-2 bg-black/40 border border-zinc-700 hover:border-red-500 transition px-5 py-3 rounded-2xl text-sm text-gray-300 hover:text-red-400"
  >
    Logout
  </button>

              <button
                onClick={() =>
                  setShowBalance(!showBalance)
                }
                className="flex items-center gap-2 bg-black/40 border border-zinc-700 hover:border-yellow-500 transition px-5 py-3 rounded-2xl text-sm"
              >
                {showBalance ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}

                {showBalance
                  ? "Hide Balance"
                  : "Show Balance"}
              </button>

              <div
                className={`px-5 py-3 rounded-2xl text-sm font-medium border ${
                  (investor?.status ?? "").toLowerCase() === "active"
                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                    : "bg-amber-500/10 text-amber-300 border-amber-500/25"
                }`}
              >
                Account {(investor?.status ?? "unknown").toUpperCase()}
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-7 items-stretch">


    {/* WALLET CARD */}
<div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 hover:border-yellow-500/40 transition duration-300 h-full flex flex-col">

  <div className="flex items-center justify-between mb-4">
    <div>
      <p className="text-gray-500 text-sm">Portfolio value</p>

      <h2 className="text-3xl font-bold mt-1">
        ${balance.toLocaleString()}
      </h2>
      <p className="text-xs text-green-400 mt-2">
        Withdrawable now: ${withdrawable.toFixed(2)}
      </p>
      <p className="text-xs text-yellow-500/90 mt-1">
        Locked principal: ${lockedPrincipal.toFixed(2)}
      </p>
    </div>

    <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
      <Wallet className="text-yellow-500 w-6 h-6" />
    </div>
  </div>
<div className="flex flex-col justify-between flex-1 py-4">

  <p className="text-sm text-gray-400 leading-relaxed">
    Total portfolio reflects deposits plus compounded daily gains. Withdrawals use
    withdrawable funds only (principal from each deposit unlocks after 30 days).
  </p>

  <div className="pt-6">
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs border border-green-500/20">
      ● Wallet Active
    </div>
  </div>

</div>

  <button
  onClick={() => setShowWalletModal(true)}
  className="mt-auto flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 transition font-semibold py-3 rounded-2xl"
>
  View Wallet
  <ArrowRight size={18} />
</button>
</div>


{/* PROFIT CARD */}
<div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 hover:border-zinc-700 transition duration-300 h-full flex flex-col">

  <div className="flex items-center justify-between mb-4">
    <div>
      <p className="text-gray-500 text-sm">Total Profit</p>

      <h2 className="text-3xl font-bold text-green-400 mt-1">
        ${Number(investor?.total_profit || 0).toFixed(2)}
      </h2>
    </div>

    <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
      <BarChart3 className="text-green-400 w-6 h-6" />
    </div>
  </div>

  <div className="flex flex-col justify-between flex-1 py-4">

  <p className="text-sm text-gray-400 leading-relaxed">
    Track your accumulated earnings and portfolio growth.
  </p>

  <div className="pt-6">
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 text-gray-300 text-xs border border-zinc-700">
      Daily ROI Distribution Active
    </div>
  </div>

</div>

  <Link
    href="/history"
    className="mt-auto flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 transition font-semibold py-3 rounded-2xl"
  >
    View Profits
    <ArrowRight size={18} />
  </Link>
</div>


  {/* Investment Plan Card */}
<div className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-zinc-950/90 backdrop-blur-xl p-6 h-full flex flex-col">

  {/* Ambient Glow */}
  <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/10 to-transparent opacity-60 pointer-events-none" />

  <div className="relative z-10 flex flex-col h-full">

    {/* HEADER */}
    <div className="flex items-center justify-between mb-5">

      <div>
        <p className="text-gray-500 text-sm mb-2">
          Current Investment Plan
        </p>

        <h2 className="text-3xl font-bold text-yellow-500 leading-tight">
          {investor ? displayPlanName(planKey) : "No Active Plan"}
        </h2>
      </div>

      <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
        ⭐
      </div>
    </div>

    {/* CONTENT */}
    <div className="flex flex-col justify-between flex-1 py-4">

      <div className="space-y-4">

        <div className="flex items-center justify-between">
          <p className="text-gray-400">
            Active Capital
          </p>

          <p className="font-semibold text-white">
            ${balance.toLocaleString()}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-gray-400">
            Daily Yield Target
          </p>

          <p className="font-semibold text-yellow-500 text-right">
            {investor ? dailyCompoundLabel(planKey) : "—"}
          </p>
        </div>

      </div>

      {/* STATUS BADGE */}
      <div className="pt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 text-gray-300 text-xs border border-zinc-700">
          Active Investment Tier
        </div>
      </div>

    </div>

    {/* BUTTON */}
    <Link
      href="/investment-plans"
      className="mt-auto flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 transition font-semibold py-3 rounded-2xl"
    >
      View Investment Plans
    </Link>

  </div>
</div>


{/* SUPPORT CARD */}
<div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 hover:border-blue-500/40 transition duration-300">

  <div className="flex items-center justify-between mb-4">
    <div>
      <p className="text-gray-500 text-sm">Priority Support</p>

      <h2 className="text-2xl font-bold mt-1">
        24/7 Assistance
      </h2>
    </div>

    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
      <Headset className="text-blue-400 w-6 h-6" />
    </div>
  </div>

  <div className="flex flex-col justify-between flex-1 py-4">

  <div className="space-y-4">
    <p className="text-sm text-gray-400 leading-relaxed">
      Get direct assistance from our investment support team anytime you need help.
    </p>

    <div className="space-y-2 text-sm">
      <p className="text-gray-300">
        askpaulfx.@gmail.com
      </p>

      <p className="text-gray-300">
        +254 797 674 560
      </p>
    </div>
  </div>

  <div className="pt-6">
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 text-gray-300 text-xs border border-zinc-700">
      Investor Support Online
    </div>
  </div>

</div>

<Link
  href="/support"
  className="mt-auto flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 transition font-semibold py-3 rounded-2xl"
>
  Contact Support
  <ArrowRight size={18} />
</Link>
</div>
          
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-7">

          <Link
            href="/deposit"
            className="bg-yellow-500 hover:bg-yellow-600 transition text-black font-bold rounded-3xl p-4 text-center"
          >
            Deposit Funds
          </Link>

          <Link
            href="/withdraw"
            className="bg-zinc-950 border border-zinc-800 hover:border-yellow-500 transition rounded-3xl p-4 text-center font-semibold"
          >
            Withdraw Funds
          </Link>

          <Link
            href="/investment-plans"
            className="bg-zinc-950 border border-zinc-800 hover:border-yellow-500 transition rounded-3xl p-4 text-center font-semibold"
          >
            Upgrade Plan
          </Link>

          <Link
            href="/support"
            className="bg-zinc-950 border border-zinc-800 hover:border-yellow-500 transition rounded-3xl p-4 text-center font-semibold"
          >
            Support Center
          </Link>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-7">

          <div className="xl:col-span-2 bg-zinc-950 border border-zinc-800 rounded-3xl p-5">

            <h2 className="text-2xl font-bold mb-1">
              Portfolio Growth
            </h2>

            <p className="text-gray-400 mb-6">
              Real growth based on actual profits.
            </p>

            <div
              className="w-full overflow-x-auto"
              style={{ minHeight: 320 }}
            >
              <AreaChart
                width={700}
                height={320}
                data={chartData}
              >
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
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 flex flex-col max-h-[min(420px,55vh)]">

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
                  <div
                    key={notification.id}
                    className="bg-black/40 border border-zinc-800 rounded-2xl p-3.5 shrink-0"
                  >
                    <h3 className="font-semibold text-sm mb-1 text-white line-clamp-1">
                      {notification.title}
                    </h3>

                    <p className="text-gray-400 text-xs leading-snug line-clamp-2">
                      {notification.message}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-center py-8 text-sm shrink-0">
                  No notifications yet.
                </div>
              )}
            </div>

          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden">

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
            className="relative w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/50"
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
    </div>
  );
}
