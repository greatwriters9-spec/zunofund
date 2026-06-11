"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import {
  CANONICAL_INVESTMENT_PLANS,
  dailyCompoundLabel,
  displayPlanName,
  formatDepositRangeDescription,
  normalizeInvestmentPlan,
  type CanonicalInvestmentPlan,
} from "@/lib/investmentPlans";
import { formatUsdAmount } from "@/lib/formatMoney";
import { AdminAccountStatusPanel } from "@/components/admin/AdminAccountStatusPanel";
import {
  ACCOUNT_STATUS_BADGE_CLASS,
  ACCOUNT_STATUS_LABEL,
  normalizeAccountStatus,
} from "@/lib/accountStatus";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

interface InvestorRow {
  id: string;
  email: string;
  full_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  surname?: string | null;
  phone?: string | null;
  balance?: number | null;
  total_profit?: number | null;
  investment_plan?: string | null;
  status?: string | null;
  account_status?: string | null;
  status_reason?: string | null;
  status_updated_at?: string | null;
  status_updated_by?: string | null;
  withdrawal_eligible_at?: string | null;
  tier_qualifying_principal?: number | null;
  tier_manual_override?: boolean | null;
  profit_auto_accrue?: boolean | null;
}

function investorMatchesSearch(inv: InvestorRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const qDigits = q.replace(/\D/g, "");
  const phoneDigits = (inv.phone ?? "").replace(/\D/g, "");

  const nameParts = [inv.first_name, inv.middle_name, inv.surname]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  const fields = [
    inv.email,
    inv.full_name,
    inv.first_name,
    inv.middle_name,
    inv.surname,
    nameParts,
    inv.phone,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  if (fields.some((value) => value.includes(q))) return true;
  if (qDigits.length >= 3 && phoneDigits.includes(qDigits)) return true;

  return false;
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
  const [searchQuery, setSearchQuery] = useState("");

  const filteredInvestors = useMemo(
    () => investors.filter((inv) => investorMatchesSearch(inv, searchQuery)),
    [investors, searchQuery],
  );

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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-3xl font-bold text-yellow-500">All Investors</h1>
        <div className="w-full sm:max-w-md">
          <label htmlFor="investor-search" className="sr-only">
            Search investors
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden
            />
            <input
              id="investor-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or phone…"
              className="w-full rounded-xl border border-zinc-700 bg-black py-2.5 pl-10 pr-10 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-yellow-500"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      </div>

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

      {!loading && investors.length > 0 ? (
        <p className="mb-4 text-sm text-zinc-500">
          {searchQuery.trim()
            ? `${filteredInvestors.length} of ${investors.length} investors`
            : `${investors.length} investors`}
        </p>
      ) : null}

      {loading ? (
        <p className="text-gray-400">Loading investors...</p>
      ) : investors.length === 0 ? (
        <p className="text-gray-400">No investors found</p>
      ) : filteredInvestors.length === 0 ? (
        <p className="text-gray-400">
          No investors match &ldquo;{searchQuery.trim()}&rdquo;
        </p>
      ) : (
        <div className="space-y-4">
          {filteredInvestors.map((inv) => (
            <div
              key={inv.id}
              className="border border-zinc-800 bg-zinc-950 p-4 rounded-xl space-y-3"
            >
              <p className="font-semibold">{inv.full_name?.trim() || "—"}</p>
              <p className="text-sm text-zinc-400">{inv.email}</p>
              <p className="text-sm text-zinc-500">
                Phone: {inv.phone?.trim() ? inv.phone : "Not provided"}
              </p>
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
              {(() => {
                const acct = normalizeAccountStatus(inv.account_status ?? inv.status);
                return (
                  <p className="text-sm">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ACCOUNT_STATUS_BADGE_CLASS[acct]}`}
                    >
                      {ACCOUNT_STATUS_LABEL[acct]}
                    </span>
                  </p>
                );
              })()}

              <AdminAccountStatusPanel
                investorId={inv.id}
                currentStatus={inv.account_status ?? inv.status}
                currentReason={inv.status_reason}
                statusUpdatedAt={inv.status_updated_at}
                withdrawalEligibleAt={inv.withdrawal_eligible_at}
                onSaved={() => void fetchInvestors()}
                onWithdrawalDateSaved={(id, withdrawalEligibleAt) => {
                  setInvestors((prev) =>
                    prev.map((row) =>
                      row.id === id ? { ...row, withdrawal_eligible_at: withdrawalEligibleAt } : row,
                    ),
                  );
                }}
              />

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
