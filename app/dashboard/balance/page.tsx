"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

import { InvestorBalanceBlock } from "@/components/dashboard/InvestorBalanceBlock";
import { InvestorPlanEarningsSection } from "@/components/dashboard/InvestorPlanEarningsSection";
import { DASHBOARD_CARD, DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";
import { normalizeInvestmentPlan } from "@/lib/investmentPlans";
import { sumTodayPnlUsd, type ProfitRow } from "@/lib/investorBalanceMetrics";
import { notificationsOwnerOrFilter } from "@/lib/notificationQuery";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";
import { useDisplayCryptoUnit, useDisplayCurrency, useFxRates } from "@/lib/useFx";

type InvestorRow = {
  balance: number;
  investment_plan: string;
};

function BalanceLoadingShell() {
  return (
    <div className="relative min-h-full bg-[#05070D] text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,rgba(212,175,55,0.08)_0%,transparent_70%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-[1400px] px-4 py-14 text-center sm:px-6">
        <p className="text-sm" style={{ color: DASHBOARD_MUTED }}>
          Loading balance…
        </p>
      </div>
    </div>
  );
}

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
    return <BalanceLoadingShell />;
  }

  return (
    <div className="relative min-h-full bg-[#05070D] text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,rgba(212,175,55,0.08)_0%,transparent_70%)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-[1400px] space-y-5 px-4 py-5 pb-6 sm:space-y-6 sm:px-6 sm:pb-8 lg:py-8">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-[#D4AF37]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Dashboard
          </Link>

          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
              Wallet
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
              Balance
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
              Change valuation unit and fiat display. Deposits and withdrawals use the same wallet.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/deposit"
              className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-[#F7E3A0] via-[#D4AF37] to-[#EAC54F] px-5 text-xs font-bold text-black shadow-[0_0_24px_rgba(212,175,55,0.25)] transition hover:brightness-105"
            >
              Deposit
            </Link>
            <Link
              href="/withdraw"
              className="inline-flex h-10 items-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-5 text-xs font-semibold text-zinc-100 transition hover:border-white/[0.2]"
            >
              Withdraw
            </Link>
          </div>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={`${DASHBOARD_CARD} p-5 sm:p-6`}
        >
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
            planKey={planKey}
            className="border-0 pb-0"
          />
        </motion.div>

        <InvestorPlanEarningsSection planKey={planKey} balanceUsd={balance} showBalance={showBalance} />
      </div>
    </div>
  );
}
