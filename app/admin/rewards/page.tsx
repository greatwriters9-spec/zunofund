"use client";

import { useCallback, useEffect, useState } from "react";

import { formatUsdAmount } from "@/lib/formatMoney";
import { rewardTypeLabel } from "@/lib/rewards";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

type Settings = {
  program_enabled: boolean;
  holding_bonus_enabled: boolean;
  holding_bonus_amount: number;
  holding_days_required: number;
  tier_growth_pro_amount: number;
  tier_pro_elite_amount: number;
  portfolio_10k_amount: number;
  portfolio_25k_amount: number;
  referral_10_amount: number;
  referral_25_amount: number;
  reinvestment_bonus_percent: number;
  reinvestment_bonus_enabled: boolean;
};

type LedgerRow = {
  id: string;
  user_id: string;
  investor_email: string | null;
  reward_key: string;
  reward_type: string;
  amount: number;
  status: string;
  description: string | null;
  granted_at: string;
};

type Stats = {
  total_grants: number;
  total_amount_usd: number;
  grants_last_7d: number;
  by_type: Record<string, number>;
};

type PendingRow = {
  id: string;
  user_id: string;
  investor_email: string | null;
  reward_key: string;
  reward_type: string;
  amount: number;
  badge_key: string | null;
  description: string | null;
  eligible_at: string;
};

export default function AdminRewardsPage() {
  const supabase = useSupabase();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantKey, setGrantKey] = useState("");
  const [grantType, setGrantType] = useState("manual_grant");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantDesc, setGrantDesc] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [settingsRes, statsRes, ledgerRes, pendingRes] = await Promise.all([
      supabase.from("reward_program_settings").select("*").eq("id", 1).single(),
      supabase.rpc("admin_reward_program_stats"),
      supabase
        .from("investor_rewards_ledger")
        .select("id, user_id, investor_email, reward_key, reward_type, amount, status, description, granted_at")
        .is("revoked_at", null)
        .order("granted_at", { ascending: false })
        .limit(40),
      supabase.rpc("admin_list_pending_reward_activations", { p_limit: 100 }),
    ]);

    if (settingsRes.data) setSettings(settingsRes.data as Settings);
    if (!statsRes.error && statsRes.data) setStats(statsRes.data as Stats);
    setLedger((ledgerRes.data ?? []) as LedgerRow[]);
    setPending((pendingRes.data ?? []) as PendingRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings() {
    if (!settings) return;
    setMessage(null);
    const { error } = await supabase
      .from("reward_program_settings")
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setMessage(error ? formatSupabaseError(error) : "Settings saved.");
  }

  async function activatePending(id: string) {
    setMessage(null);
    const { data, error } = await supabase.rpc("admin_activate_investor_reward", {
      p_eligibility_id: id,
    });
    if (error) {
      setMessage(formatSupabaseError(error));
      return;
    }
    setMessage(data ? "Reward activated and credited." : "Could not activate (already done or missing).");
    void load();
  }

  async function manualGrant() {
    setMessage(null);
    const { data, error } = await supabase.rpc("admin_grant_investor_reward", {
      p_investor_user_id: grantUserId.trim(),
      p_reward_key: grantKey.trim(),
      p_reward_type: grantType.trim() || "manual_grant",
      p_amount: Number(grantAmount) || 0,
      p_description: grantDesc.trim() || null,
    });
    if (error) {
      setMessage(formatSupabaseError(error));
      return;
    }
    setMessage(data ? "Reward granted." : "Reward not granted (duplicate or program disabled).");
    void load();
  }

  async function revokeReward(id: string) {
    const { error } = await supabase.rpc("admin_revoke_investor_reward", {
      p_ledger_id: id,
      p_reason: "Admin revoke",
    });
    setMessage(error ? formatSupabaseError(error) : "Reward revoked.");
    void load();
  }

  if (loading) {
    return <p className="text-zinc-500">Loading rewards program…</p>;
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-[#F5E6B3]">Rewards & Loyalty</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Investors see eligible rewards on their dashboard; only you can activate them to credit balances and badges.
      </p>

      {message ? (
        <p className="mt-4 rounded-lg border border-zinc-700/80 bg-zinc-900/50 px-4 py-2 text-sm text-zinc-200">
          {message}
        </p>
      ) : null}

      {stats ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase text-zinc-500">Total grants</p>
            <p className="mt-1 text-2xl font-bold text-white">{stats.total_grants}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase text-zinc-500">Total USD credited</p>
            <p className="mt-1 text-2xl font-bold text-yellow-400">
              {formatUsdAmount(Number(stats.total_amount_usd))}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase text-zinc-500">Last 7 days</p>
            <p className="mt-1 text-2xl font-bold text-white">{stats.grants_last_7d}</p>
          </div>
        </div>
      ) : null}

      <section className="mt-8 rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-300">
          Pending activations ({pending.length})
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Investors earned these rewards; activate to credit USDT and apply badges.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="py-2 pr-3">Eligible since</th>
                <th className="py-2 pr-3">Investor</th>
                <th className="py-2 pr-3">Reward</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => (
                <tr key={row.id} className="border-b border-zinc-900/80 text-zinc-300">
                  <td className="py-2 pr-3 text-xs">
                    {new Date(row.eligible_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">
                    {row.investor_email ?? row.user_id.slice(0, 8)}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="font-medium">{row.reward_key}</span>
                    <span className="ml-2 text-zinc-600">{rewardTypeLabel(row.reward_type)}</span>
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-yellow-400">
                    {Number(row.amount) > 0 ? formatUsdAmount(Number(row.amount)) : row.badge_key ?? "—"}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => void activatePending(row.id)}
                      className="rounded-lg bg-[#D4AF37] px-3 py-1.5 text-xs font-bold text-black hover:bg-[#E5BD45]"
                    >
                      Activate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pending.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600">No rewards waiting for activation.</p>
          ) : null}
        </div>
      </section>

      {settings ? (
        <section className="mt-8 rounded-xl border border-white/10 bg-black/25 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#D4AF37]">Program settings</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(
              [
                ["program_enabled", "Program enabled", "checkbox"],
                ["holding_bonus_enabled", "Holding bonus enabled", "checkbox"],
                ["reinvestment_bonus_enabled", "Reinvestment bonus enabled", "checkbox"],
                ["holding_bonus_amount", "Holding bonus ($)", "number"],
                ["holding_days_required", "Holding days required", "number"],
                ["tier_growth_pro_amount", "Growth→Pro ($)", "number"],
                ["tier_pro_elite_amount", "Pro→Elite ($)", "number"],
                ["portfolio_10k_amount", "Portfolio $10k ($)", "number"],
                ["portfolio_25k_amount", "Portfolio $25k ($)", "number"],
                ["referral_10_amount", "10 referrals ($)", "number"],
                ["referral_25_amount", "25 referrals ($)", "number"],
                ["reinvestment_bonus_percent", "Reinvestment %", "number"],
              ] as const
            ).map(([key, label, kind]) => (
              <label key={key} className="flex flex-col gap-1 text-sm text-zinc-400">
                {label}
                {kind === "checkbox" ? (
                  <input
                    type="checkbox"
                    checked={Boolean(settings[key as keyof Settings])}
                    onChange={(e) =>
                      setSettings({ ...settings, [key]: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                ) : (
                  <input
                    type="number"
                    value={Number(settings[key as keyof Settings])}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        [key]: Number(e.target.value),
                      })
                    }
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                  />
                )}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void saveSettings()}
            className="mt-4 rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black hover:bg-[#E5BD45]"
          >
            Save settings
          </button>
        </section>
      ) : null}

      <section className="mt-8 rounded-xl border border-white/10 bg-black/25 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#D4AF37]">Manual grant</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            placeholder="Investor user_id (UUID)"
            value={grantUserId}
            onChange={(e) => setGrantUserId(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white sm:col-span-2"
          />
          <input
            placeholder="Reward key (unique)"
            value={grantKey}
            onChange={(e) => setGrantKey(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
          <input
            placeholder="Reward type"
            value={grantType}
            onChange={(e) => setGrantType(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
          <input
            placeholder="Amount USD"
            value={grantAmount}
            onChange={(e) => setGrantAmount(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
          <input
            placeholder="Description"
            value={grantDesc}
            onChange={(e) => setGrantDesc(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white sm:col-span-2"
          />
        </div>
        <button
          type="button"
          onClick={() => void manualGrant()}
          className="mt-4 rounded-lg border border-[#D4AF37]/40 px-4 py-2 text-sm font-semibold text-[#F5E6B3] hover:bg-[#D4AF37]/10"
        >
          Grant reward
        </button>
      </section>

      <section className="mt-8 rounded-xl border border-white/10 bg-black/25 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#D4AF37]">Audit log (recent)</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((row) => (
                <tr key={row.id} className="border-b border-zinc-900/80 text-zinc-300">
                  <td className="py-2 pr-3 text-xs">
                    {new Date(row.granted_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{row.investor_email ?? row.user_id.slice(0, 8)}</td>
                  <td className="py-2 pr-3">{rewardTypeLabel(row.reward_type)}</td>
                  <td className="py-2 pr-3 tabular-nums text-yellow-400">
                    {Number(row.amount) > 0 ? formatUsdAmount(Number(row.amount)) : "—"}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => void revokeReward(row.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ledger.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600">No reward grants yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
