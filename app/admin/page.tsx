"use client";


import Link from "next/link";

import { useCallback, useEffect, useState } from "react";

import { displayPlanName, normalizeInvestmentPlan } from "@/lib/investmentPlans";
import { useSupabase } from "@/lib/supabase";

import {
  LayoutDashboard,
  Wallet,
  ArrowDownCircle,
  Users,
  TrendingUp,
  Settings,
  LogOut,
  ShieldCheck,
  MessageCircle,
} from "lucide-react";

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

  const [pendingDeposits, setPendingDeposits] =
    useState(0);

  const [pendingWithdrawals, setPendingWithdrawals] =
    useState(0);

  const [totalInvestors, setTotalInvestors] =
    useState(0);

  const [investors, setInvestors] = useState<
    Investor[]
  >([]);

  const fetchDashboardData = useCallback(async () => {
    // Pending Deposits
    const { count: depositsCount } = await supabase
      .from("deposits")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "pending");

    // Pending Withdrawals
    const { count: withdrawalsCount } = await supabase
      .from("withdrawals")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "pending");

    // Investors Count
    const { count: investorsCount } = await supabase
      .from("investors")
      .select("*", {
        count: "exact",
        head: true,
      });

    // Investors List
    const { data: investorsData } = await supabase
      .from("investors")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    setPendingDeposits(depositsCount || 0);

    setPendingWithdrawals(withdrawalsCount || 0);

    setTotalInvestors(investorsCount || 0);

    setInvestors(investorsData || []);
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

  async function handleLogout() {
    await supabase.auth.signOut();

    window.location.href = "/admin-login";
  }

  return (
    <div className="min-h-screen bg-black text-white flex">

      {/* Sidebar */}
      <aside className="w-72 bg-zinc-950 border-r border-zinc-800 p-6 flex flex-col justify-between">

        <div>

          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">

            <ShieldCheck
              className="text-yellow-500"
              size={34}
            />

            <div>
              <h1 className="text-2xl font-bold text-yellow-500">
                Admin Panel
              </h1>

              <p className="text-gray-500 text-sm">
                Trading Management
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-3">

            <Link
              href="/admin"
              className="flex items-center gap-3 bg-yellow-500 text-black font-semibold px-5 py-4 rounded-2xl"
            >
              <LayoutDashboard size={20} />
              Dashboard
            </Link>

            <Link
              href="/admin/deposits"
              className="flex items-center gap-3 hover:bg-zinc-900 transition px-5 py-4 rounded-2xl text-gray-300"
            >
              <Wallet size={20} />
              Deposits
            </Link>

            <Link
              href="/admin/withdrawals"
              className="flex items-center gap-3 hover:bg-zinc-900 transition px-5 py-4 rounded-2xl text-gray-300"
            >
              <ArrowDownCircle size={20} />
              Withdrawals
            </Link>

            <Link
              href="/admin/investors"
              className="flex items-center gap-3 hover:bg-zinc-900 transition px-5 py-4 rounded-2xl text-gray-300"
            >
              <Users size={20} />
              Investors
            </Link>

            <Link
              href="/admin/profits"
              className="flex items-center gap-3 hover:bg-zinc-900 transition px-5 py-4 rounded-2xl text-gray-300"
            >
              <TrendingUp size={20} />
              Profits
            </Link>

            {/* SUPPORT BUTTON */}
            <Link
              href="/admin/support"
              className="flex items-center gap-3 hover:bg-zinc-900 transition px-5 py-4 rounded-2xl text-gray-300"
            >
              <MessageCircle size={20} />
              Support
            </Link>

            <Link
              href="/admin/settings"
              className="flex items-center gap-3 hover:bg-zinc-900 transition px-5 py-4 rounded-2xl text-gray-300"
            >
              <Settings size={20} />
              Settings
            </Link>

          </nav>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 transition py-4 rounded-2xl font-semibold"
        >
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-auto">

        {/* Header */}
        <div className="mb-10">

          <h1 className="text-5xl font-bold text-yellow-500 mb-3">
            Welcome Admin
          </h1>

          <p className="text-gray-400 text-lg">
            Manage investors, deposits,
            withdrawals and profits.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">

          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6">
            <p className="text-gray-400 mb-3">
              Pending Deposits
            </p>

            <h2 className="text-5xl font-bold text-yellow-500">
              {pendingDeposits}
            </h2>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6">
            <p className="text-gray-400 mb-3">
              Pending Withdrawals
            </p>

            <h2 className="text-5xl font-bold text-yellow-500">
              {pendingWithdrawals}
            </h2>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6">
            <p className="text-gray-400 mb-3">
              Total Investors
            </p>

            <h2 className="text-5xl font-bold text-yellow-500">
              {totalInvestors}
            </h2>
          </div>
        </div>

        {/* Investor Table */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden">

          <div className="p-6 border-b border-zinc-800">

            <h2 className="text-3xl font-bold mb-2">
              Investor Management
            </h2>

            <p className="text-gray-500">
              Monitor investor accounts and
              balances.
            </p>
          </div>

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="bg-zinc-900 text-gray-400 text-sm">

                <tr>
                  <th className="text-left p-5">
                    Investor
                  </th>

                  <th className="text-left p-5">
                    Balance
                  </th>

                  <th className="text-left p-5">
                    Total Profit
                  </th>

                  <th className="text-left p-5">
                    Plan
                  </th>

                  <th className="text-left p-5">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>

                {investors.length > 0 ? (
                  investors.map((investor) => (
                    <tr
                      key={investor.id}
                      className="border-t border-zinc-800 hover:bg-zinc-900 transition"
                    >

                      <td className="p-5">
                        <div>
                          <h3 className="font-semibold">
                            {
                              investor.full_name
                            }
                          </h3>

                          <p className="text-gray-500 text-sm">
                            {investor.email}
                          </p>
                        </div>
                      </td>

                      <td className="p-5 font-semibold">
                        $
                        {Number(
                          investor.balance || 0
                        ).toFixed(2)}
                      </td>

                      <td className="p-5 text-green-500 font-semibold">
                        +$
                        {Number(
                          investor.total_profit ||
                            0
                        ).toFixed(2)}
                      </td>

                      <td className="p-5 text-yellow-500 font-semibold">
                        {
                          displayPlanName(
                            normalizeInvestmentPlan(investor.investment_plan),
                          )
                        }
                      </td>

                      <td className="p-5">

                        <span className="bg-green-500/10 text-green-500 px-4 py-2 rounded-xl text-sm font-medium">
                          {investor.status}
                        </span>

                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center p-10 text-gray-500"
                    >
                      No investors found.
                    </td>
                  </tr>
                )}

              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}