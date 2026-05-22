"use client";

import { useCallback, useEffect, useState } from "react";

import { formatSignedUsdAmount, formatUsdAmount } from "@/lib/formatMoney";
import { displayPlanName, normalizeInvestmentPlan } from "@/lib/investmentPlans";
import { useSupabase } from "@/lib/supabase";

interface Investor {
  id: string;
  full_name: string;
  email: string;
  balance: number;
  total_profit: number;
  investment_plan: string;
  status: string;
}

export default function AdminPage() {
  const supabase = useSupabase();

  const [pendingDeposits, setPendingDeposits] = useState(0);

  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);

  const [totalInvestors, setTotalInvestors] = useState(0);

  const [investors, setInvestors] = useState<Investor[]>([]);

  const fetchDashboardData = useCallback(async () => {
    const investorListCols =
      "id, full_name, email, balance, total_profit, investment_plan, status, created_at";

    const [
      depositsCountRes,
      withdrawalsCountRes,
      investorsCountRes,
      investorsListRes,
    ] = await Promise.all([
      supabase
        .from("deposits")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("status", "pending"),
      supabase
        .from("withdrawals")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("status", "pending"),
      supabase.from("investors").select("*", {
        count: "exact",
        head: true,
      }),
      supabase
        .from("investors")
        .select(investorListCols)
        .order("created_at", {
          ascending: false,
        })
        .limit(300),
    ]);

    setPendingDeposits(depositsCountRes.count ?? 0);

    setPendingWithdrawals(withdrawalsCountRes.count ?? 0);

    setTotalInvestors(investorsCountRes.count ?? 0);

    setInvestors((investorsListRes.data as Investor[]) || []);
  }, [supabase]);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    const reload = () => {
      void fetchDashboardData();
    };
    window.addEventListener("tp:admin-notification", reload);
    return () => {
      window.removeEventListener("tp:admin-notification", reload);
    };
  }, [fetchDashboardData]);

  return (
    <>
      <div className="border-b border-[#D4AF37]/10 pb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          <span className="text-[#D4AF37]">Admin</span> overview
        </h1>

        <p className="mt-3 max-w-2xl text-sm text-zinc-500">
          Same shell as investor P2P — dark canvas, gold accents, wide content rail.
        </p>
      </div>

      <div className="mb-10 mt-8 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#D4AF37]/18 bg-black/35 p-6 backdrop-blur-sm">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Pending deposits</p>

          <h2 className="text-4xl font-bold tabular-nums text-[#F5E6B3]">{pendingDeposits}</h2>
        </div>

        <div className="rounded-2xl border border-[#D4AF37]/18 bg-black/35 p-6 backdrop-blur-sm">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Pending withdrawals</p>

          <h2 className="text-4xl font-bold tabular-nums text-[#F5E6B3]">{pendingWithdrawals}</h2>
        </div>

        <div className="rounded-2xl border border-[#D4AF37]/18 bg-black/35 p-6 backdrop-blur-sm">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Total investors</p>

          <h2 className="text-4xl font-bold tabular-nums text-[#F5E6B3]">{totalInvestors}</h2>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#D4AF37]/18 bg-black/35 backdrop-blur-sm">
        <div className="border-b border-white/10 px-6 py-5">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#F5E6B3]">
            Investor management
          </h2>

          <p className="mt-2 text-xs text-zinc-500">Monitor investor accounts and balances.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-white/10 bg-black/40 text-left text-[11px] uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="p-5">Investor</th>

                <th className="p-5">Balance</th>

                <th className="p-5">Total Profit</th>

                <th className="p-5">Plan</th>

                <th className="p-5">Status</th>
              </tr>
            </thead>

            <tbody>
              {investors.length > 0 ? (
                investors.map((investor) => (
                  <tr
                    key={investor.id}
                    className="border-t border-white/10 bg-black/20 transition hover:bg-black/40"
                  >
                    <td className="p-5">
                      <div>
                        <h3 className="font-semibold text-[#F5E6B3]">{investor.full_name}</h3>

                        <p className="text-sm text-zinc-500">{investor.email}</p>
                      </div>
                    </td>

                    <td className="p-5 font-semibold tabular-nums text-white">
                      {formatUsdAmount(investor.balance)}
                    </td>

                    <td className="p-5 font-semibold tabular-nums text-emerald-400">
                      {formatSignedUsdAmount(investor.total_profit)}
                    </td>

                    <td className="p-5 font-semibold text-[#D4AF37]">
                      {displayPlanName(normalizeInvestmentPlan(investor.investment_plan))}
                    </td>

                    <td className="p-5">
                      <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                        {investor.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-zinc-500">
                    No investors found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
