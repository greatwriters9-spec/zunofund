"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import type { ProfitChartDatum } from "@/components/dashboard/ProfitGrowthChart";
import { buildPortfolioGrowthChartData } from "@/lib/portfolioGrowthChart";
import { notificationsOwnerOrFilter } from "@/lib/notificationQuery";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

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

const PROFIT_COLUMNS = "amount, status, created_at";

export function PortfolioGrowthPanel() {
  const supabase = useSupabase();
  const [chartData, setChartData] = useState<ProfitChartDatum[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email || !user.id) {
        setChartData([]);
        return;
      }

      const owner = notificationsOwnerOrFilter({
        userId: user.id,
        investorEmail: user.email.trim(),
      });

      const { data, error } = await supabase
        .from("profits")
        .select(PROFIT_COLUMNS)
        .or(owner)
        .order("created_at", { ascending: true })
        .limit(500);

      if (error) {
        console.error("[portfolio-growth] profits:", formatSupabaseError(error));
        setChartData([]);
        return;
      }

      setChartData(buildPortfolioGrowthChartData(data ?? []));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div
        className="min-h-[240px] w-full animate-pulse rounded-lg bg-zinc-900/40 sm:min-h-[280px] md:min-h-[300px]"
        style={{ height: 300 }}
      />
    );
  }

  return (
    <div className="chart-panel-stable">
      <ProfitGrowthChart data={chartData} />
    </div>
  );
}
