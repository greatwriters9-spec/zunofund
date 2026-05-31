"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { InvestorBalanceBlock } from "@/components/dashboard/InvestorBalanceBlock";
import { InvestorPlanEarningsSection } from "@/components/dashboard/InvestorPlanEarningsSection";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";
import { notificationsOwnerOrFilter } from "@/lib/notificationQuery";
import { normalizeInvestmentPlan } from "@/lib/investmentPlans";
import { sumTodayPnlUsd, type ProfitRow } from "@/lib/investorBalanceMetrics";
import { useDisplayCryptoUnit, useDisplayCurrency, useFxRates } from "@/lib/useFx";

type InvestorRow = {
  balance: number;
  investment_plan: string;
};

export default function DashboardBalancePage() {
  const supabase = useSupabase();
  const [loading, setLoading] = useState(true);
  const [investor, setInvestor] = useState<InvestorRow | null>(null);
  const [todayPnlUsd, setTodayPnlUsd] = useState(0);
  const [showBalance, setShowBalance] = useState(true);

  const [displayCurrency, setDisplayCurrency] = useDisplayCurrency();
  const [displayCrypto, setDisplayCrypto] = useDisplayCryptoUnit();
  const { rates: fxRates } = useFxRates();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email || !user.id) {
        setInvestor(null);
        setTodayPnlUsd(0);
        return;
      }

      const profitOwner = notificationsOwnerOrFilter({
        userId: user.id,
        investorEmail: user.email.trim(),
      });

      const [investorRes, profitsRes] = await Promise.all([
        supabase.from("investors").select("balance, investment_plan").eq("user_id", user.id).single(),
        supabase
          .from("profits")
          .select("amount, status, created_at")
          .or(profitOwner)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      if (investorRes.error) {
        console.error("[balance] investors:", formatSupabaseError(investorRes.error));
      }

      setInvestor((investorRes.data as InvestorRow | null) ?? null);
      const profits = (profitsRes.data ?? []) as ProfitRow[];
      setTodayPnlUsd(sumTodayPnlUsd(profits));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const syncTodayPnl = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email || !user.id) return;

    const profitOwner = notificationsOwnerOrFilter({
      userId: user.id,
      investorEmail: user.email.trim(),
    });

    const { data: investorRow } = await supabase
      .from("investors")
      .select("balance, investment_plan")
      .eq("user_id", user.id)
      .single();
    if (investorRow) setInvestor(investorRow as InvestorRow);

    const { data: profits } = await supabase
      .from("profits")
      .select("amount, status, created_at")
      .or(profitOwner)
      .order("created_at", { ascending: false })
      .limit(500);

    setTodayPnlUsd(sumTodayPnlUsd((profits ?? []) as ProfitRow[]));
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onProfitCredited = (ev: Event) => {
      const row = (ev as CustomEvent<Record<string, unknown>>).detail;
      const type = typeof row?.type === "string" ? row.type : "";
      if (type === "profit_compound" || type === "profit_bonus") {
        void syncTodayPnl();
      }
    };
    window.addEventListener("tp:investor-notification", onProfitCredited);
    return () => window.removeEventListener("tp:investor-notification", onProfitCredited);
  }, [syncTodayPnl]);

  const balance = Number(investor?.balance ?? 0);
  const planKey = normalizeInvestmentPlan(investor?.investment_plan);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05080F] text-white">
        Loading balance…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05080F] text-white">
      <div className="mx-auto max-w-3xl p-5 md:p-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-yellow-500 transition hover:text-yellow-400"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to dashboard
        </Link>

        <h1 className="mt-4 text-2xl font-bold tracking-tight">Balance</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Change valuation unit and fiat display. Deposits and withdrawals use the same wallet.
        </p>

        <div className="mt-8">
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
            showAddFunds
            showCurrencyPickers
          />
        </div>

        <InvestorPlanEarningsSection planKey={planKey} balanceUsd={balance} showBalance={showBalance} />
      </div>
    </div>
  );
}
