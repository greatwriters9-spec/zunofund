"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { formatMoneyAmount, formatUsdLocale } from "@/lib/formatMoney";
import { coerceRpcBigint, formatSupabaseError, useSupabase } from "@/lib/supabase";
import { normalizeInvestmentPlan } from "@/lib/investmentPlans";
import { fetchInvestorNotificationSnapshot } from "@/lib/dashboardInvestorAlerts";
import { notificationsOwnerOrFilter } from "@/lib/notificationQuery";
import { buildReferralSignupPath } from "@/lib/referrals";
import { useDisplayCryptoUnit, useDisplayCurrency, useFxRates } from "@/lib/useFx";
import { sumTodayPnlUsd, type ProfitRow } from "@/lib/investorBalanceMetrics";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { InvestorBalanceBlock } from "@/components/dashboard/InvestorBalanceBlock";
import { DashboardPremiumContent } from "@/components/dashboard/premium/DashboardPremiumContent";
import { DashboardPremiumView } from "@/components/dashboard/premium/DashboardPremiumView";
import { DashboardReferralPanel } from "@/components/dashboard/DashboardReferralPanel";

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
  const planKey = normalizeInvestmentPlan(investor?.investment_plan);

  const [displayCurrency, setDisplayCurrency] = useDisplayCurrency();
  const [displayCrypto, setDisplayCrypto] = useDisplayCryptoUnit();
  const { rates: fxRates } = useFxRates();
  const [todayPnlUsd, setTodayPnlUsd] = useState(0);

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
        .slice(0, 4);

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
      <div className="flex min-h-[50vh] items-center justify-center bg-[#05070D] text-sm text-[#8A93A5]">
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="page-content-stable relative min-h-screen overflow-x-clip bg-[#05070D] text-white">
      <div className="relative z-10 mx-auto max-w-7xl p-5 lg:mx-0 lg:max-w-none lg:p-0">

        {/* Mobile: balance hero, quick actions, active plan, portfolio, then remaining cards */}
        <div className="lg:hidden">
          <InvestorBalanceBlock
            balanceUsd={balance}
            showBalance={showBalance}
            onToggleShowBalance={() => setShowBalance((v) => !v)}
            displayCrypto={displayCrypto}
            displayCurrency={displayCurrency}
            onDisplayCryptoChange={setDisplayCrypto}
            onDisplayCurrencyChange={setDisplayCurrency}
            fxRates={fxRates}
            todayPnlUsd={todayPnlUsd}
            amountLinksToBalance
            showAddFunds
            planKey={planKey}
          />

          <DashboardQuickActions
            referralOpen={referralPanelOpen}
            onReferralToggle={() => setReferralPanelOpen((o) => !o)}
          />

          {referralPanelOpen && referralCode ? (
            <div className="mt-4">
              <DashboardReferralPanel
                referralCode={referralCode}
                referralLink={referralLink}
                copied={copiedReferral}
                onCopy={() => void copyReferralLink()}
              />
            </div>
          ) : null}

          <div className="mt-6">
            <DashboardPremiumContent
              layout="mobile"
              showKpi={false}
              showCompactSupport={false}
              showBalance={showBalance}
              balance={balance}
              withdrawable={withdrawable}
              totalProfit={Number(investor?.total_profit || 0)}
              todayPnlUsd={todayPnlUsd}
              fxRates={fxRates}
              activities={activities}
              planKey={planKey}
              accountStatus={investor?.status ?? "unknown"}
              merchantProfile={merchantProfile ?? null}
            />
          </div>
        </div>

        {/* Desktop: welcome header + KPI row + premium grid */}
        <div className="hidden lg:block">
          <DashboardPremiumView
            investorName={investorGreetingName(investor)}
            avatarUrl={investor?.avatar_url}
            profileAvatarBroken={profileAvatarBroken}
            onProfileAvatarError={() => setProfileAvatarBroken(true)}
            planKey={planKey}
            accountStatus={investor?.status ?? "unknown"}
            showBalance={showBalance}
            onToggleShowBalance={() => setShowBalance((v) => !v)}
            balance={balance}
            withdrawable={withdrawable}
            totalProfit={Number(investor?.total_profit || 0)}
            todayPnlUsd={todayPnlUsd}
            fxRates={fxRates}
            displayCrypto={displayCrypto}
            displayCurrency={displayCurrency}
            onDisplayCryptoChange={setDisplayCrypto}
            onDisplayCurrencyChange={setDisplayCurrency}
            activities={activities}
            merchantProfile={merchantProfile ?? null}
          />
        </div>
      </div>

    </div>
  );
}
