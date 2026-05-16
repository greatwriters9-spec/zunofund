"use client";

import { useEffect, useState } from "react";
import {
  CANONICAL_INVESTMENT_PLANS,
  dailyCompoundLabel,
  displayPlanName,
  formatDepositRangeDescription,
  normalizeInvestmentPlan,
  type CanonicalInvestmentPlan,
} from "@/lib/investmentPlans";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

interface InvestorRow {
  id: string;
  email: string;
  balance?: number | null;
  total_profit?: number | null;
  investment_plan?: string | null;
  status?: string | null;
}

export default function InvestorsPage() {
  const supabase = useSupabase();

  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftById, setDraftById] = useState<
    Record<string, CanonicalInvestmentPlan>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchInvestors();
  }, []);

  useEffect(() => {
    const m: Record<string, CanonicalInvestmentPlan> = {};
    for (const inv of investors) {
      m[inv.id] = normalizeInvestmentPlan(inv.investment_plan);
    }
    setDraftById(m);
  }, [investors]);

  async function fetchInvestors() {
    setLoading(true);

    const { data, error } = await supabase
      .from("investors")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setInvestors([]);
      setFormError(formatSupabaseError(error));
      setLoading(false);
      return;
    }

    setInvestors(data || []);
    setLoading(false);
  }

  async function savePlan(inv: InvestorRow) {
    const slug = draftById[inv.id];
    if (!slug || slug === normalizeInvestmentPlan(inv.investment_plan)) {
      setFormSuccess("Plan unchanged.");
      return;
    }
    setFormError(null);
    setFormSuccess(null);
    setSavingId(inv.id);
    const { error } = await supabase
      .from("investors")
      .update({ investment_plan: slug })
      .eq("id", inv.id);
    setSavingId(null);

    if (error) {
      setFormError(formatSupabaseError(error));
      return;
    }

    setFormSuccess(
      `${inv.email}: plan saved as ${slug}. Deposit limits follow this tier.`,
    );
    await fetchInvestors();
  }

  return (
    <div className="p-10 text-white bg-black min-h-screen">
      <h1 className="text-3xl mb-6 font-bold text-yellow-500">
        All Investors
      </h1>

      {formError ? (
        <div
          className="mb-4 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-red-300 text-sm"
          role="alert"
        >
          {formError}
        </div>
      ) : null}

      {formSuccess ? (
        <div
          className="mb-4 rounded-xl border border-green-500/50 bg-green-500/10 px-4 py-3 text-green-300 text-sm"
          role="status"
        >
          {formSuccess}
        </div>
      ) : null}

      {loading ? (
        <p className="text-gray-400">Loading investors...</p>
      ) : investors.length === 0 ? (
        <p className="text-gray-400">No investors found</p>
      ) : (
        <div className="space-y-4">
          {investors.map((inv) => (
            <div
              key={inv.id}
              className="border border-zinc-800 bg-zinc-950 p-4 rounded-xl space-y-3"
            >
              <p className="font-semibold">{inv.email}</p>
              <p className="text-gray-400">
                Balance: ${Number(inv.balance || 0).toFixed(2)}
              </p>
              <p className="text-green-500">
                Profit: ${Number(inv.total_profit || 0).toFixed(2)}
              </p>
              <p className="text-blue-400">Status: {inv.status}</p>

              <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-2 border-t border-zinc-800">
                <div className="flex-1">
                  <label className="block text-xs text-zinc-500 mb-1">
                    Investment plan (daily rate + deposit window)
                  </label>
                  <select
                    className="w-full sm:max-w-md bg-black border border-zinc-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-yellow-500"
                    value={
                      draftById[inv.id] ??
                      normalizeInvestmentPlan(inv.investment_plan)
                    }
                    onChange={(e) =>
                      setDraftById((prev) => ({
                        ...prev,
                        [inv.id]: e.target.value as CanonicalInvestmentPlan,
                      }))
                    }
                  >
                    {CANONICAL_INVESTMENT_PLANS.map((slug) => (
                      <option key={slug} value={slug}>
                        {displayPlanName(slug)} — deposits{" "}
                        {formatDepositRangeDescription(slug)} ·{" "}
                        {dailyCompoundLabel(slug)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={savingId === inv.id}
                  onClick={() => savePlan(inv)}
                  className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-semibold px-5 py-2 rounded-xl text-sm"
                >
                  {savingId === inv.id ? "Saving…" : "Save plan"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
