"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import { X, Menu } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import {
  Bell,
  Wallet,
  BarChart3,
  Headset,
  ArrowRight,
  UserRound,
  Store,
  ArrowLeftRight,
} from "lucide-react";

import {
  formatMoneyAmount,
  formatSignedUsdAmount,
  formatUsdAmountsInText,
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
import { formatFiat } from "@/lib/currencies";
import { buildReferralSignupPath } from "@/lib/referrals";
import { useDisplayCurrency, useFxRates } from "@/lib/useFx";
import { sumTodayPnlUsd, type ProfitRow } from "@/lib/investorBalanceMetrics";
import { InvestorBalanceBlock } from "@/components/dashboard/InvestorBalanceBlock";
import { InvestorEarlyMemberPromo } from "@/components/dashboard/InvestorEarlyMemberPromo";
import { DashboardHubButtons } from "@/components/dashboard/DashboardHubButtons";
import { DashboardNotificationsCard } from "@/components/dashboard/DashboardNotificationsCard";
import { PortfolioGrowthPanel } from "@/components/dashboard/PortfolioGrowthPanel";
import { DashboardTrendingMarkets } from "@/components/dashboard/DashboardTrendingMarkets";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { DashboardReferralPanel } from "@/components/dashboard/DashboardReferralPanel";
import { PlatformContactDisplay } from "@/components/contact/PlatformContactDisplay";

const PROFIT_FEED_COLUMNS =
  "id, amount, status, created_at, profit_origin, investment_plan_snapshot";

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

  const [showWalletModal, setShowWalletModal] = useState(false)
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [referralPanelOpen, setReferralPanelOpen] = useState(false);
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

  const [displayCurrency] = useDisplayCurrency();
  const { rates: fxRates } = useFxRates();
  const [todayPnlUsd, setTodayPnlUsd] = useState(0);

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

      setTodayPnlUsd(sumTodayPnlUsd(profitsChronoAsc));
    } catch (e) {
      console.error("Dashboard load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const syncBalanceAndTodayPnl = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email || !user.id) return;

    const profitOwner = notificationsOwnerOrFilter({
      userId: user.id,
      investorEmail: user.email.trim(),
    });

    const [investorRes, profitsRes] = await Promise.all([
      supabase.from("investors").select("*").eq("user_id", user.id).single(),
      supabase
        .from("profits")
        .select("amount, status, created_at")
        .or(profitOwner)
        .order("created_at", { ascending: true }),
    ]);

    if (!investorRes.error && investorRes.data) {
      setInvestor(investorRes.data as Investor);
    }
    if (!profitsRes.error) {
      setTodayPnlUsd(sumTodayPnlUsd((profitsRes.data ?? []) as ProfitRow[]));
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
    const onRealtimeOrInsert = (ev: Event) => {
      void syncInvestorAlerts();
      const row = (ev as CustomEvent<Record<string, unknown>>).detail;
      const type = typeof row?.type === "string" ? row.type : "";
      if (type === "profit_compound" || type === "profit_bonus") {
        void syncBalanceAndTodayPnl();
      }
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
  }, [syncBalanceAndTodayPnl, syncInvestorAlerts]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void syncInvestorAlerts();
        void syncBalanceAndTodayPnl();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [syncBalanceAndTodayPnl, syncInvestorAlerts]);

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
    if (!t) return "Investor";
    const lower = t.toLocaleLowerCase();
    const first = lower.charAt(0).toLocaleUpperCase();
    return `${first}${lower.slice(1)}`;
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
    const native = fromUsd(value, displayCurrency, fxRates);
    return formatFiat(native, displayCurrency);
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
    <div className="page-content-stable relative min-h-screen overflow-x-clip bg-[#05080F] text-white">
      <div className="relative z-10 mx-auto max-w-7xl p-5 max-md:pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:mx-0 lg:max-w-none lg:p-0">

        {/* Mobile top toolbar: menu hard-left, profile+bell hard-right */}
        <div className="mb-5 flex items-center justify-between gap-2 lg:hidden">
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

        {/* Desktop profile strip (Binance-style header card) */}
        <div className="mb-6 hidden items-center gap-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 lg:flex">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-yellow-500/30 bg-yellow-500/10">
            {investor?.avatar_url && !profileAvatarBroken ? (
              <Image
                src={investor.avatar_url}
                alt=""
                fill
                sizes="56px"
                className="object-cover"
                onError={() => setProfileAvatarBroken(true)}
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <UserRound className="text-yellow-500" size={28} aria-hidden />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-white">
              {investor?.full_name?.trim() || investorGreetingName(investor)}
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              {getGreeting()} · {displayPlanName(planKey)}
            </p>
          </div>
          <div
            className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium ${
              (investor?.status ?? "").toLowerCase() === "active"
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/25 bg-amber-500/10 text-amber-300"
            }`}
          >
            {(investor?.status ?? "unknown").toUpperCase()}
          </div>
        </div>

        {/* Mobile greeting */}
        <div className="mb-7 lg:hidden">
          <h1 className="mb-2 text-2xl sm:text-3xl">
            <span className="font-normal text-zinc-400">{getGreeting()}, </span>
            <span className="font-bold text-white">{investorGreetingName(investor)}</span>
          </h1>
          <p className="text-gray-400">Welcome back.</p>
        </div>

        <div className="mb-8">
          <div className="lg:rounded-xl lg:border lg:border-zinc-800/80 lg:bg-zinc-950/40 lg:p-6">
            <div className="lg:flex lg:items-start lg:justify-between lg:gap-8">
              <div className="min-w-0 flex-1">
                <InvestorBalanceBlock
                  balanceUsd={balance}
                  showBalance={showBalance}
                  onToggleShowBalance={() => setShowBalance((v) => !v)}
                  displayCrypto="USDT"
                  displayCurrency={displayCurrency}
                  fxRates={fxRates}
                  todayPnlUsd={todayPnlUsd}
                  amountLinksToBalance
                  showAddFunds
                />
              </div>
              <div className="mt-4 hidden shrink-0 flex-col gap-2 sm:flex-row lg:mt-0 lg:flex lg:flex-col lg:pt-1">
                <Link
                  href="/deposit"
                  className="inline-flex min-w-[7.5rem] items-center justify-center rounded-md bg-yellow-500 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-400"
                >
                  Deposit
                </Link>
                <Link
                  href="/withdraw"
                  className="inline-flex min-w-[7.5rem] items-center justify-center rounded-md border border-zinc-600 bg-zinc-900/80 px-5 py-2.5 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500"
                >
                  Withdraw
                </Link>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-zinc-600 lg:px-1">
            Global crypto market cap{" "}
            <span className="font-medium text-zinc-400">
              {globalMarketCapUsd != null
                ? formatMarketCapUsd(globalMarketCapUsd)
                : "—"}
            </span>
            <span className="text-zinc-600"> · CoinGecko</span>
          </p>

          <DashboardQuickActions
            referralOpen={referralPanelOpen}
            onReferralToggle={() => {
              if (!referralCode) return;
              setReferralPanelOpen((open) => !open);
            }}
          />

          {referralPanelOpen && referralCode ? (
            <DashboardReferralPanel
              referralCode={referralCode}
              referralLink={referralLink}
              copied={copiedReferral}
              onCopy={() => void copyReferralLink()}
            />
          ) : null}

          <div
            className={`mt-4 inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium lg:mx-1 ${
              (investor?.status ?? "").toLowerCase() === "active"
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/25 bg-amber-500/10 text-amber-300"
            }`}
          >
            Account {(investor?.status ?? "unknown").toUpperCase()}
          </div>
        </div>

        <InvestorEarlyMemberPromo className="mb-6 lg:mx-1" />

        <div className="dashboard-mobile-grid mb-6 grid grid-cols-2 items-stretch gap-2 sm:gap-3 lg:grid-cols-4 lg:gap-4">


    {/* WALLET — minimal */}
<div className="flex flex-col rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">

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
    Wallet withdrawable {walletMoneyLabel(withdrawable)}
  </p>
  <p className="text-[11px] leading-snug text-zinc-500">
    Locked (P2P OK) {walletMoneyLabel(lockedPrincipal)}
  </p>
  <p className="mt-3 line-clamp-2 text-[11px] leading-snug text-zinc-600">
    Crypto wallet: profits anytime; principal unlocks after 30 days. Sell full
    balance anytime on P2P.
  </p>

  <button
    type="button"
    onClick={() => setShowWalletModal(true)}
    className="mt-auto flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700/90 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-yellow-500/40 hover:text-white"
  >
    Wallet
    <ArrowRight size={14} aria-hidden />
  </button>
</div>


{/* PROFIT — minimal */}
<div className="flex flex-col rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">

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
    className="mt-auto flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700/90 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-yellow-500/40 hover:text-white"
  >
    History
    <ArrowRight size={14} aria-hidden />
  </Link>
</div>


  {/* PLAN — minimal */}
<div className="flex flex-col rounded-xl border border-yellow-500/15 bg-yellow-500/[0.03] p-4 sm:p-5">

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
    className="mt-auto flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700/90 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-yellow-500/40 hover:text-white"
  >
    Plans
    <ArrowRight size={14} aria-hidden />
  </Link>
</div>


{/* SUPPORT — minimal */}
<div className="flex flex-col rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">

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
  className="mt-auto flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700/90 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-yellow-500/40 hover:text-white"
>
  Contact
  <ArrowRight size={14} aria-hidden />
</Link>
</div>
          
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

        <section
          id="portfolio-growth"
          className="mb-7 hidden scroll-mt-24 lg:grid lg:grid-cols-3 lg:gap-4"
          aria-labelledby="portfolio-growth-heading"
        >
          <div className="flex min-w-0 flex-col md:col-span-2">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  id="portfolio-growth-heading"
                  className="text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                >
                  Portfolio growth
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Real growth based on profits credited to your account.
                </p>
              </div>
              <Link
                href="/dashboard/growth"
                className="shrink-0 text-xs font-semibold text-yellow-500 transition hover:text-yellow-400"
              >
                Full view →
              </Link>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
              <PortfolioGrowthPanel />
            </div>
          </div>

          <DashboardNotificationsCard
            notifications={notifications}
            unreadCount={unreadNotificationCount}
            onMarkRead={(id) => void markNotificationAsRead(id)}
          />
        </section>

        <DashboardHubButtons merchantStatus={merchantProfile?.status} />

        <DashboardTrendingMarkets />

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
                  Crypto wallet limits only — P2P can use your full portfolio.
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
                <dt className="text-sm text-zinc-400">Locked principal (30 days)</dt>
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
              Wallet withdrawals use withdrawable funds only (profits first, then matured
              principal). New deposit principal unlocks after 30 days. Use P2P to sell locked
              principal anytime.
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
          className="surface-menu-mobile fixed inset-0 z-[210] flex flex-col pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))] px-6 lg:hidden"
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
              href="/dashboard/growth"
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
