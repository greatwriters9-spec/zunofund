"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";
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
  Store,
  ArrowLeftRight,
  Copy,
  Gift,
} from "lucide-react";

import type { ProfitChartDatum } from "@/components/dashboard/ProfitGrowthChart";
import {
  formatMoneyAmount,
  formatSignedUsdAmount,
  formatUsdLocale,
} from "@/lib/formatMoney";
import { coerceRpcBigint, formatSupabaseError, useSupabase } from "@/lib/supabase";
import {
  dailyCompoundLabel,
  displayPlanName,
  normalizeInvestmentPlan,
} from "@/lib/investmentPlans";
import { fetchInvestorNotificationSnapshot } from "@/lib/dashboardInvestorAlerts";
import { notificationsOwnerOrFilter } from "@/lib/notificationQuery";
import { fromUsd } from "@/lib/exchangeRates";
import { fmtAssetAmount } from "@/lib/p2pAssets";
import { formatFiat, getFiatCurrency } from "@/lib/currencies";
import { buildReferralSignupPath } from "@/lib/referrals";
import { useDisplayCryptoUnit, useDisplayCurrency, useFxRates } from "@/lib/useFx";
import { CryptoUnitPicker } from "@/components/currency/CryptoUnitPicker";
import { CurrencyPicker } from "@/components/currency/CurrencyPicker";
import { PlatformContactDisplay } from "@/components/contact/PlatformContactDisplay";

const PROFIT_FEED_COLUMNS =
  "id, amount, status, created_at, profit_origin, investment_plan_snapshot";

const ProfitGrowthChart = dynamic(
  () =>
    import("@/components/dashboard/ProfitGrowthChart").then((m) => ({
      default: m.ProfitGrowthChart,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-[240px] w-full animate-pulse rounded-lg bg-zinc-900/40 sm:min-h-[280px] md:min-h-[300px]"
        style={{ height: 300 }}
      />
    ),
  },
);

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
  referral_code?: string | null;
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

export default function DashboardPage() {
  const supabase = useSupabase();

  const [investor, setInvestor] = useState<Investor | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [activities, setActivities] = useState<Activity[]>([]);

  const [chartData, setChartData] = useState<ProfitChartDatum[]>([]);

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
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [appOrigin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );

  const [loading, setLoading] = useState(true);
  const [merchantProfile, setMerchantProfile] = useState<{ status: string } | null | undefined>(
    undefined,
  );
  const [profileAvatarBroken, setProfileAvatarBroken] = useState(false);
  /** Global crypto market cap (USD), CoinGecko — informational only. */
  const [globalMarketCapUsd, setGlobalMarketCapUsd] = useState<number | null>(
    null,
  );
  const balance = Number(investor?.balance || 0);
  const withdrawable = Number(investor?.withdrawable_balance ?? balance);
  const lockedPrincipal = Number(investor?.locked_principal_balance ?? 0);
  const planKey = normalizeInvestmentPlan(investor?.investment_plan);

  const [displayCurrency, setDisplayCurrency] = useDisplayCurrency();
  const [displayCrypto, setDisplayCrypto] = useDisplayCryptoUnit();
  const { rates: fxRates } = useFxRates();
  const displayCurrencyMeta = getFiatCurrency(displayCurrency);

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
    let cancelled = false;
    const ac = new AbortController();
    fetch("/api/market/global", {
      signal: ac.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((payload: { totalMarketCapUsd?: number | null }) => {
        const v = payload?.totalMarketCapUsd;
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

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email || !user.id) {
        return;
      }

      const profitOwner = notificationsOwnerOrFilter({
        userId: user.id,
        investorEmail: user.email.trim(),
      });

      const [
        investorRes,
        merchantProfRes,
        snap,
        depositsRes,
        withdrawalsRes,
        profitsRes,
      ] = await Promise.all([
        supabase
          .from("investors")
          .select("*")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("merchant_profiles")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle(),
        fetchInvestorNotificationSnapshot(
          supabase,
          user.id,
          user.email.trim(),
        ),
        supabase
          .from("deposits")
          .select("id, amount, status, created_at")
          .eq("user_id", user.id),
        supabase
          .from("withdrawals")
          .select("id, amount, status, created_at")
          .eq("user_id", user.id),
        supabase
          .from("profits")
          .select(PROFIT_FEED_COLUMNS)
          .or(profitOwner)
          .order("created_at", { ascending: true }),
      ]);

      if (investorRes.error) {
        console.error(
          "[dashboard] investors row:",
          formatSupabaseError(investorRes.error),
        );
      }

      if (merchantProfRes.error) {
        console.error(
          "[dashboard] merchant_profiles:",
          formatSupabaseError(merchantProfRes.error),
        );
      }
      setMerchantProfile(
        merchantProfRes.error
          ? null
          : ((merchantProfRes.data as { status: string } | null) ?? null),
      );

      setInvestor(investorRes.data as Investor | null);

      setNotifications(snap.preview as Notification[]);
      setUnreadNotificationCount(snap.unreadTotal);

      const deposits = depositsRes.data;
      const withdrawals = withdrawalsRes.data;

      const profitsRaw = profitsRes.data;

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
            new Date(a.created_at).getTime(),
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
    } catch (e) {
      console.error("Dashboard load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void fetchDashboardData();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        void fetchDashboardData();
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchDashboardData, supabase]);

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
    if (displayCrypto === "BTC") {
      return fmtAssetAmount("BTC", fromUsd(value, "BTC", fxRates));
    }
    const native = fromUsd(value, displayCurrency, fxRates);
    return formatFiat(native, displayCurrency);
  }

  function formatBalanceHeadline(): string {
    if (!showBalance) return "••••••";
    if (displayCrypto === "BTC") {
      return fmtAssetAmount("BTC", fromUsd(balance, "BTC", fxRates));
    }
    return `${formatMoneyAmount(balance)} USDT`;
  }

  function formatBalanceSubline(): string {
    if (!showBalance) return "••••••";
    if (displayCrypto === "BTC") {
      const usdt =
        balance > 0 ? `${formatMoneyAmount(balance)} USDT` : null;
      const fiat = `≈ ${formatFiat(fromUsd(balance, displayCurrency, fxRates), displayCurrency)}`;
      return usdt ? `≈ ${usdt} · ${fiat}` : fiat;
    }
    return `≈ ${formatFiat(fromUsd(balance, displayCurrency, fxRates), displayCurrency)}`;
  }

  function formatMarketCapUsd(value: number): string {
    if (value >= 1e12)
      return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return formatUsdLocale(value);
  }

  const referralCode = investor?.referral_code?.trim() ?? "";
  const referralSignupPath = buildReferralSignupPath(referralCode);
  const referralLink = appOrigin ? `${appOrigin}${referralSignupPath}` : referralSignupPath;

  async function copyReferralLink() {
    if (!referralCode) return;
    await navigator.clipboard.writeText(referralLink);
    setCopiedReferral(true);
    window.setTimeout(() => setCopiedReferral(false), 2200);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white text-xl">
        Loading Dashboard...
      </div>
    );
  }

  return (
    <div className="page-content-stable relative min-h-screen overflow-x-clip bg-[#05080F] text-white max-lg:bg-[#05080F] lg:bg-transparent">
      <div className="relative z-10 mx-auto max-w-7xl p-5 md:p-7">

        {/* Mobile top toolbar: menu hard-left, profile+bell hard-right */}
        <div className="mb-5 flex items-center justify-between gap-2 md:hidden">
          <button
            type="button"
            className="surface-panel flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition hover:border-yellow-500"
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
              className="surface-panel flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition hover:border-yellow-500"
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
              className="surface-panel relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition hover:border-yellow-500"
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
              className="surface-panel rounded-2xl p-3 transition hover:border-yellow-500"
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
              className="surface-panel relative rounded-2xl p-4 transition hover:border-yellow-500"
            >
              <Bell className="text-yellow-500" size={24} />

              {unreadNotificationCount > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </div>
              )}
            </button>

            {showNotifications && (
              <div className="surface-panel-elevated absolute right-0 z-50 mt-4 w-[min(360px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden shadow-2xl lg:rounded-xl">

                <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 px-4 py-3">
                  <h2 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    Notifications
                  </h2>
                  <Link
                    href="/notifications"
                    className="text-xs font-semibold text-yellow-500 transition hover:text-yellow-400"
                  >
                    View all
                  </Link>
                </div>

                <div className="max-h-[min(420px,55vh)] overflow-y-auto">
                  {notifications.length > 0 ? (
                    <div className="divide-y divide-zinc-800/80">
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() =>
                            markNotificationAsRead(notification.id)
                          }
                          className="w-full px-4 py-3 text-left transition hover:bg-zinc-900/50"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-semibold text-white">
                              {notification.title}
                            </h3>
                            <span
                              className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500"
                              aria-hidden
                            />
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-snug text-zinc-500">
                            {notification.message}
                          </p>
                          <p className="mt-2 text-[11px] tabular-nums text-zinc-600">
                            {new Date(notification.created_at).toLocaleString()}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-10 text-center text-sm text-zinc-500">
                      No notifications.
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-zinc-800/80 px-4 py-3">
                  <p className="text-xs text-zinc-500">
                    {unreadNotificationCount > 0
                      ? `${unreadNotificationCount} unread`
                      : "No notifications."}
                  </p>
                  <Link
                    href="/notifications"
                    className="text-xs font-semibold text-yellow-500 transition hover:text-yellow-400"
                  >
                    View all
                  </Link>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>

        <div className="dashboard-balance-stable mb-8 border-b border-zinc-800/90 pb-8">
          <p className="text-sm font-medium text-zinc-500">Total balance</p>

          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 text-4xl font-bold tabular-nums tracking-tight text-white sm:text-5xl md:text-[3.25rem]">
              {formatBalanceHeadline()}
            </p>
            <button
              type="button"
              onClick={() => setShowBalance(!showBalance)}
              className="flex h-8 shrink-0 items-center gap-1.5 self-center rounded-lg border border-zinc-700/80 bg-transparent px-2.5 text-sm text-zinc-300 transition hover:border-yellow-500/50 hover:text-white"
              aria-pressed={showBalance}
              aria-label={showBalance ? "Hide balance" : "Show balance"}
            >
              {showBalance ? (
                <EyeOff size={16} aria-hidden />
              ) : (
                <Eye size={16} aria-hidden />
              )}
              <span className="text-xs">
                {showBalance ? "Hide" : "Show"}
              </span>
            </button>
          </div>

          <p
            className="mt-2 text-base tabular-nums text-zinc-500"
            title={
              displayCrypto === "BTC"
                ? "Investment balance in USDT and fiat"
                : `${displayCurrencyMeta.name} · ${displayCurrencyMeta.code}`
            }
          >
            {formatBalanceSubline()}
          </p>

          <div className="mt-2 flex flex-row flex-wrap items-center gap-2">
            <CryptoUnitPicker value={displayCrypto} onChange={setDisplayCrypto} size="sm" />
            <CurrencyPicker
              value={displayCurrency}
              onChange={setDisplayCurrency}
              size="sm"
              align="start"
              triggerVariant="code-only"
            />
          </div>

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

        {referralCode ? (
          <div className="mb-6 rounded-xl border border-yellow-500/15 bg-yellow-500/[0.04] px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-yellow-500/90">
                  <Gift size={14} aria-hidden />
                  5% Network Rewards
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Your network moves. You earn 5%.
                </p>
              </div>
              <div className="flex min-w-0 flex-col gap-2 sm:w-[25rem]">
                <div className="flex min-w-0 items-center gap-2 rounded-lg border border-zinc-800 bg-black/35 px-3 py-2">
                  <span className="shrink-0 rounded bg-yellow-500/10 px-2 py-1 font-mono text-xs font-bold text-yellow-300">
                    {referralCode}
                  </span>
                  <span className="truncate text-xs text-zinc-500" title={referralLink}>
                    {referralLink}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyReferralLink()}
                    className="ml-auto shrink-0 text-zinc-400 transition hover:text-yellow-400"
                    aria-label="Copy 5% Network Rewards link"
                  >
                    <Copy size={15} aria-hidden />
                  </button>
                </div>
                {copiedReferral ? (
                  <p className="text-right text-[11px] text-emerald-400">5% Network Rewards link copied.</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

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
    {walletMoneyLabel(balance)}
  </p>
  <p className="mt-1 text-[11px] leading-snug text-emerald-400/90">
    Withdrawable {walletMoneyLabel(withdrawable)}
  </p>
  <p className="text-[11px] leading-snug text-zinc-500">
    Locked {walletMoneyLabel(lockedPrincipal)}
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
    {walletMoneyLabel(Number(investor?.total_profit || 0))}
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
        {walletMoneyLabel(balance)}
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
  <PlatformContactDisplay variant="compact" />

<Link
  href="/support"
  className="mt-auto flex items-center justify-center gap-1.5 border border-zinc-700/90 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-yellow-500/40 hover:text-white lg:rounded-lg"
>
  Contact
  <ArrowRight size={14} aria-hidden />
</Link>
</div>
          
        </div>

        <div className="mb-7 grid grid-cols-5 gap-1.5 md:grid-cols-2 md:gap-3 xl:grid-cols-5 xl:gap-4">

          <Link
            href="/deposit"
            className="rounded-xl bg-yellow-500 px-1.5 py-3 text-center text-[11px] font-bold text-black transition hover:bg-yellow-600 sm:text-[13px] md:px-4 md:text-sm"
          >
            Deposit
          </Link>

          <Link
            href="/withdraw"
            className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-1.5 py-3 text-center text-[11px] font-semibold text-white transition hover:border-yellow-500/50 sm:text-[13px] md:px-4 md:text-sm"
          >
            Withdraw
          </Link>

          <Link
            href="/p2p"
            className="relative overflow-hidden rounded-xl border border-emerald-500/35 bg-gradient-to-br from-emerald-500/15 via-emerald-500/8 to-yellow-500/10 px-1.5 py-3 text-center text-[11px] font-bold text-emerald-300 shadow-[0_0_20px_-8px_rgba(16,185,129,0.55)] transition hover:border-emerald-400/70 hover:shadow-[0_0_28px_-6px_rgba(16,185,129,0.7)] sm:text-[13px] md:px-4 md:text-sm"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-2 -top-2 hidden h-10 w-10 rounded-full bg-emerald-500/20 blur-2xl lg:block"
            />
            <span className="relative">P2P</span>
          </Link>

          <Link
            href="/investment-plans"
            className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-1.5 py-3 text-center text-[11px] font-semibold text-white transition hover:border-yellow-500/50 sm:text-[13px] md:px-4 md:text-sm"
          >
            Plans
          </Link>

          <Link
            href="/support"
            className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-1.5 py-3 text-center text-[11px] font-semibold text-white transition hover:border-yellow-500/50 sm:text-[13px] md:px-4 md:text-sm"
          >
            Support
          </Link>
        </div>

        {merchantProfile != null &&
        (merchantProfile.status === "active" || merchantProfile.status === "pending") ? (
          <div className="mb-7 rounded-xl border border-yellow-500/25 bg-yellow-500/[0.06] p-4 sm:p-5 lg:rounded-xl">
            <div className="flex gap-3">
              <Store className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" aria-hidden />
              <div className="min-w-0">
                <h2 className="text-[11px] font-medium uppercase tracking-wide text-yellow-600/90">
                  Merchant — your P2P offers
                </h2>
                {merchantProfile.status === "active" ? (
                  <>
                    <p className="mt-1 text-sm text-zinc-400">
                      Create buy and sell listings; active offers are visible to every investor under{" "}
                      <Link href="/p2p" className="text-yellow-500 hover:underline">
                        P2P
                      </Link>
                      .
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href="/merchant"
                        className="rounded-xl border border-yellow-500/40 bg-yellow-500/15 px-4 py-2 text-center text-sm font-semibold text-yellow-300 transition hover:border-yellow-500/60"
                      >
                        Merchant dashboard
                      </Link>
                      <Link
                        href="/merchant/offers/new?side=sell_usdt"
                        className="rounded-xl border border-red-500/45 bg-red-500/15 px-4 py-2 text-center text-sm font-semibold text-red-300 transition hover:border-red-400/70"
                      >
                        New sell-USDT offer
                      </Link>
                      <Link
                        href="/merchant/offers/new?side=buy_usdt"
                        className="rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 py-2 text-center text-sm font-semibold text-white transition hover:border-yellow-500/50"
                      >
                        New buy-USDT offer
                      </Link>
                    </div>
                  </>
                ) : merchantProfile.status === "pending" ? (
                  <p className="mt-1 text-sm text-zinc-400">
                    Your merchant application is pending admin approval. You will be able to post offers once
                    activated.{" "}
                    <Link href="/merchant" className="text-yellow-500 hover:underline">
                      View status
                    </Link>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-zinc-400">
                    Merchant status:{" "}
                    <span className="font-medium capitalize text-zinc-300">{merchantProfile.status}</span>.{" "}
                    <Link href="/merchant" className="text-yellow-500 hover:underline">
                      Open merchant area
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mb-7 grid grid-cols-1 gap-3 xl:grid-cols-3 xl:gap-4">

          <div
            id="portfolio-growth"
            className="flex flex-col border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5 lg:rounded-xl xl:col-span-2"
          >
            <div className="mb-4 border-b border-zinc-800/80 pb-3">
              <h2 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Portfolio growth
              </h2>
              <p className="mt-0.5 text-xs text-zinc-600">
                Real growth based on actual profits.
              </p>
            </div>

            <div className="chart-panel-stable">
              <ProfitGrowthChart data={chartData} />
            </div>
          </div>

          <div className="flex max-h-[min(420px,55vh)] flex-col border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5 lg:rounded-xl">
            <div className="mb-0 flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
              <h2 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Notifications
              </h2>
              <Link
                href="/notifications"
                className="text-xs font-semibold text-yellow-500 transition hover:text-yellow-400"
              >
                View all
              </Link>
            </div>

            <div className="scroll-panel-stable min-h-0 flex-1 overflow-y-auto">
              {notifications.length > 0 ? (
                <div className="divide-y divide-zinc-800/80">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      className="w-full py-3 text-left transition first:pt-1 hover:bg-zinc-900/40"
                      onClick={() => markNotificationAsRead(notification.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-white line-clamp-1">
                          {notification.title}
                        </span>
                        <span
                          className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500"
                          aria-hidden
                        />
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-snug text-zinc-500">
                        {notification.message}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-zinc-500">
                  No notifications.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-hidden border border-zinc-800/80 bg-zinc-950/40 lg:rounded-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 px-4 py-3 sm:px-5">
            <h2 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Recent activity
            </h2>
            <Link
              href="/history"
              className="text-xs font-semibold text-yellow-500 transition hover:text-yellow-400"
            >
              View all
            </Link>
          </div>

          <div className="divide-y divide-zinc-800/80">
            {activities.length > 0 ? (
              activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold capitalize text-white">
                      {activity.type}
                    </h3>
                    <p className="text-xs text-zinc-500">{activity.status}</p>
                  </div>

                  <div
                    className={`shrink-0 text-base font-bold tabular-nums sm:text-lg ${
                      activity.type === "withdrawal"
                        ? "text-red-500"
                        : "text-emerald-400"
                    }`}
                  >
                    {activity.type === "withdrawal"
                      ? formatSignedUsdAmount(-Math.abs(Number(activity.amount)))
                      : formatSignedUsdAmount(activity.amount)}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-10 text-center text-sm text-zinc-500 sm:px-5">
                No recent activity.
              </div>
            )}
          </div>
        </div>
      </div>

      {showWalletModal ? (
        <div
          className="surface-overlay fixed inset-0 z-[200] flex items-center justify-center p-5"
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
          className="surface-menu-mobile fixed inset-0 z-[210] flex flex-col pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))] px-6 md:hidden"
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
              href="/p2p"
              className="flex items-center gap-3 rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              <ArrowLeftRight className="h-5 w-5 shrink-0 text-[#D4AF37]" aria-hidden />
              P2P marketplace
            </Link>
            <Link
              href="/p2p/history"
              className="rounded-xl px-4 py-4 pl-12 text-[14px] text-zinc-400 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              P2P trade history
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
              href="/withdraw"
              className="rounded-xl px-4 py-4 text-[#E5E7EB]/90 transition hover:bg-white/5 hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              Withdraw
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
