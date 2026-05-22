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
import { formatUsdAmount } from "@/lib/formatMoney";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

interface InvestorRow {
  id: string;
  email: string;
  balance?: number | null;
  total_profit?: number | null;
  investment_plan?: string | null;
  status?: string | null;
  tier_qualifying_principal?: number | null;
  tier_manual_override?: boolean | null;
  profit_auto_accrue?: boolean | null;
}

export default function InvestorsPage() {
  const supabase = useSupabase();

  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftById, setDraftById] = useState<
    Record<string, CanonicalInvestmentPlan>
  >({});
  const [profitAutoDraft, setProfitAutoDraft] = useState<
    Record<string, boolean>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchInvestors();
  }, []);

  useEffect(() => {
    const m: Record<string, CanonicalInvestmentPlan> = {};
    const pa: Record<string, boolean> = {};
    for (const inv of investors) {
      m[inv.id] = normalizeInvestmentPlan(inv.investment_plan);
      pa[inv.id] = inv.profit_auto_accrue !== false;
    }
    setDraftById(m);
    setProfitAutoDraft(pa);
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
    if (!slug) {
      setFormError("Choose an investment plan.");
      return;
    }
    setFormError(null);
    setFormSuccess(null);
    setSavingId(inv.id);
    const { error } = await supabase
      .from("investors")
      .update({
        investment_plan: slug,
        tier_manual_override: true,
      })
      .eq("id", inv.id);
    setSavingId(null);

    if (error) {
      setFormError(formatSupabaseError(error));
      return;
    }

    setFormSuccess(
      `${inv.email}: plan saved as ${slug} (manual override — automatic tier from principal is paused).`,
    );
    await fetchInvestors();
  }

  async function saveProfitAuto(inv: InvestorRow) {
    const enabled = profitAutoDraft[inv.id] ?? true;
    setFormError(null);
    setFormSuccess(null);
    setSavingId(inv.id);
    const { error } = await supabase
      .from("investors")
      .update({ profit_auto_accrue: enabled })
      .eq("id", inv.id);
    setSavingId(null);

    if (error) {
      setFormError(formatSupabaseError(error));
      return;
    }

    setFormSuccess(
      `${inv.email}: ${enabled ? "automatic daily profit on (~24h cadence)." : "daily profit paused — credit manually on Profits."}`,
    );
    await fetchInvestors();
  }

  async function clearTierOverride(inv: InvestorRow) {
    setFormError(null);
    setFormSuccess(null);
    setSavingId(inv.id);
    const { error } = await supabase.rpc("admin_clear_tier_override_and_sync", {
      p_investor_id: inv.id,
    });
    setSavingId(null);

    if (error) {
      setFormError(formatSupabaseError(error));
      return;
    }

    setFormSuccess(
      `${inv.email}: manual tier cleared — tier recomputed from qualifying principal.`,
    );
    await fetchInvestors();
  }

  return (
    <div className="p-10 text-white min-h-screen">
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
                Balance: {formatUsdAmount(inv.balance)}
              </p>
              <p className="text-zinc-400 text-sm">
                Qualifying principal (tier basis):{" "}
                {formatUsdAmount(inv.tier_qualifying_principal)}
                {inv.tier_manual_override ? (
                  <span className="ml-2 text-amber-400">
                    · manual tier override
                  </span>
                ) : (
                  <span className="ml-2 text-zinc-600">· automatic</span>
                )}
              </p>
              <p className="text-green-500">
                Profit: {formatUsdAmount(inv.total_profit)}
              </p>
              <p className="text-blue-400">Status: {inv.status}</p>

              <div className="space-y-3 pt-2 border-t border-zinc-800">
                <label className="flex items-start gap-3 text-sm text-zinc-300 cursor-pointer select-none max-w-xl">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 rounded border-zinc-600 bg-zinc-900 text-yellow-500 focus:ring-yellow-500/40"
                    checked={profitAutoDraft[inv.id] ?? true}
                    onChange={(e) =>
                      setProfitAutoDraft((prev) => ({
                        ...prev,
                        [inv.id]: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    <strong className="text-white">
                      Automatic daily profit (compound job)
                    </strong>
                    <span className="block text-zinc-500 text-xs mt-1 leading-relaxed">
                      Uncheck to pause automated accrual for this investor only,
                      then record profits on the Profits admin page.
                    </span>
                  </span>
                </label>
                <button
                  type="button"
                  disabled={savingId === inv.id}
                  onClick={() => void saveProfitAuto(inv)}
                  className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-100 font-semibold px-5 py-2 rounded-xl text-sm disabled:opacity-50"
                >
                  {savingId === inv.id ? "Saving…" : "Save profit accrual"}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-2 border-t border-zinc-800">
                <div className="flex-1">
                  <label className="block text-xs text-zinc-500 mb-1">
                    Investment plan (daily rate; saving locks automatic tier)
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
                        {displayPlanName(slug)} — bracket{" "}
                        {formatDepositRangeDescription(slug)} ·{" "}
                        {dailyCompoundLabel(slug)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingId === inv.id}
                    onClick={() => clearTierOverride(inv)}
                    className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-100 font-semibold px-5 py-2 rounded-xl text-sm disabled:opacity-50"
                  >
                    Use auto tier
                  </button>
                  <button
                    type="button"
                    disabled={savingId === inv.id}
                    onClick={() => savePlan(inv)}
                    className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-semibold px-5 py-2 rounded-xl text-sm"
                  >
                    {savingId === inv.id ? "Saving…" : "Save plan (manual)"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
