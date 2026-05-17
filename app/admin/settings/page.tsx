"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CANONICAL_INVESTMENT_PLANS,
  dailyCompoundLabel,
  displayPlanName,
  formatDepositRangeDescription,
} from "@/lib/investmentPlans";
import { useSupabase } from "@/lib/supabase";

export default function AdminSettingsPage() {
  const supabase = useSupabase();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user?.email ?? null);
    });
  }, [supabase.auth]);

  return (
    <div className="p-10 text-white min-h-screen max-w-4xl">
      <h1 className="text-3xl font-bold text-yellow-500 mb-2">Settings</h1>
      <p className="text-zinc-400 mb-10">
        Reference for how the platform is configured today and what admins can
        change from this dashboard.
      </p>

      {sessionEmail ? (
        <section className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-950 px-6 py-5">
          <h2 className="text-lg font-semibold text-white mb-2">
            Signed in
          </h2>
          <p className="text-zinc-300 text-sm">
            {sessionEmail} — password and MFA are managed in Supabase Auth (see
            project dashboard → Authentication).
          </p>
        </section>
      ) : null}

      <section className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-950 px-6 py-5 space-y-3">
        <h2 className="text-lg font-semibold text-white">
          What admins can edit here
        </h2>
        <ul className="list-disc list-inside text-zinc-300 text-sm space-y-2">
          <li>
            Investor <strong>tier / plan</strong> (controls daily compound rate +
            deposit min/max){' '}
            <Link href="/admin/investors" className="text-yellow-500 underline">
              on the Investors page
            </Link>
            .
          </li>
          <li>
            <strong>Deposits & withdrawals</strong> approval queues on their
            respective pages—those actions run the audited server functions.
          </li>
        </ul>
      </section>

      <section className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-950 px-6 py-5 space-y-4">
        <h2 className="text-lg font-semibold text-white">
          Investment tiers (code + DB)
        </h2>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Daily percentages and USD deposit bands are enforced in Postgres on
          new deposits and mirrored in{' '}
          <code className="text-yellow-400/90">lib/investmentPlans.ts</code> for
          the UI. Changing rates or ranges requires a migration or deploy, not
          this page alone.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border border-zinc-800 rounded-xl overflow-hidden">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Deposit window (USD)</th>
                <th className="px-4 py-3 font-medium">Daily compound</th>
              </tr>
            </thead>
            <tbody>
              {CANONICAL_INVESTMENT_PLANS.map((slug) => (
                <tr
                  key={slug}
                  className="border-t border-zinc-800 bg-black/40"
                >
                  <td className="px-4 py-3 text-white">
                    {displayPlanName(slug)}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {formatDepositRangeDescription(slug)}
                  </td>
                  <td className="px-4 py-3 text-green-400/90">
                    {dailyCompoundLabel(slug)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-950 px-6 py-5 space-y-3">
        <h2 className="text-lg font-semibold text-white">
          Locks & withdrawals
        </h2>
        <ul className="list-disc list-inside text-zinc-300 text-sm space-y-2">
          <li>
            Each <strong>approved deposit</strong> adds principal that stays{' '}
            <strong>locked for 30 days</strong>; after that slice matures it
            moves to withdrawable balance.
          </li>
          <li>
            <strong>Daily profit</strong> compounds per tier; withdrawals use
            the split between locked principal and withdrawable balance shown on
            the investor dashboard.
          </li>
        </ul>
      </section>

      <section className="mb-10 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-6 py-5 space-y-3">
        <h2 className="text-lg font-semibold text-amber-300">
          Operations (must be scheduled)
        </h2>
        <p className="text-zinc-300 text-sm leading-relaxed">
          Compounding job and principal unlocks rely on PostgreSQL routines
          (e.g.{' '}
          <code className="text-yellow-400/90">run_daily_investment_jobs()</code>{' '}
          as{' '}
          <code className="text-yellow-400/90">service_role</code>). Schedule
          that about once per day in Supabase—pg cron, Edge, or external
          runner—or maturities and periodic accruals will not advance on their
          own.
        </p>
      </section>

      <p className="text-zinc-500 text-xs">
        <Link href="/admin" className="text-yellow-500/80 underline">
          ← Back to admin dashboard
        </Link>
      </p>
    </div>
  );
}
