"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { formatSupabaseError, useSupabase } from "@/lib/supabase";

type MerchantRow = {
  user_id: string;
  investor_email: string;
  display_name: string | null;
  status: string;
  applied_at: string;
  reviewed_at: string | null;
};

export default function AdminMerchantsPage() {
  const supabase = useSupabase();

  const [rows, setRows] = useState<MerchantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [loadBusy, setLoadBusy] = useState(true);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [activateImmediately, setActivateImmediately] = useState(true);
  const [provisionBusy, setProvisionBusy] = useState(false);
  const [provisionOk, setProvisionOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadBusy(true);
    setError(null);
    const { data, error: e } = await supabase.rpc("admin_list_merchant_profiles");

    setLoadBusy(false);
    if (e) {
      setError(formatSupabaseError(e));
      setRows([]);
      return;
    }

    setRows((data as MerchantRow[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(uid: string, approve: boolean) {
    setBusyUid(uid);
    setError(null);
    const { error: e } = await supabase.rpc("admin_review_merchant_application", {
      p_user_id: uid,
      p_approve: approve,
      p_note: null,
    });
    setBusyUid(null);
    if (e) {
      setError(formatSupabaseError(e));
      return;
    }
    await load();
  }

  async function revoke(uid: string) {
    if (
      !window.confirm(
        "Remove merchant access? Their offers will be deactivated and the profile set to suspended.",
      )
    ) {
      return;
    }
    setBusyUid(uid);
    setError(null);
    const res = await fetch("/api/admin/merchants/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ userId: uid }),
    });
    const json = (await res.json()) as { error?: string };
    setBusyUid(null);
    if (!res.ok) {
      setError(json.error ?? "Revoke failed");
      return;
    }
    await load();
  }

  async function provision(e: React.FormEvent) {
    e.preventDefault();
    setProvisionBusy(true);
    setError(null);
    setProvisionOk(null);

    const res = await fetch("/api/admin/merchants/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        email: email.trim(),
        displayName: displayName.trim() || null,
        activateImmediately,
      }),
    });

    const json = (await res.json()) as {
      error?: string;
      activated?: boolean;
    };

    setProvisionBusy(false);

    if (!res.ok) {
      setError(json.error ?? "Provision failed");
      return;
    }

    let msg = "Merchant profile saved for this investor.";
    if (json.activated === false) {
      msg += " Account is pending — approve below.";
    }
    setProvisionOk(msg);
    setEmail("");
    setDisplayName("");
    await load();
  }

  const pending = rows.filter((r) => r.status === "pending");

  return (
    <div className="min-w-0 max-w-6xl text-white">
      <div className="border-b border-[#D4AF37]/10 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          <span className="text-[#D4AF37]">Merchants</span> control
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
          Register existing investors as merchants (same login they already use), approve pending profiles, and revoke
          access. Matches the investor P2P rail styling.
        </p>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {provisionOk ? (
        <div className="mt-6 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {provisionOk}
        </div>
      ) : null}

      <section className="mt-8 rounded-2xl border border-[#D4AF37]/18 bg-black/35 p-5 backdrop-blur-sm sm:p-6">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#F5E6B3]">
          Register investor as merchant
        </h2>
        <p className="mt-2 text-xs text-zinc-500">
          Email must match an existing <strong className="text-zinc-400">investor</strong> account. This attaches a merchant
          profile to that user.
        </p>

        <form onSubmit={(ev) => void provision(ev)} className="mt-6 space-y-4">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="merchant@example.com"
                className="mt-2 w-full rounded-xl border border-white/12 bg-black/45 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#D4AF37]/40 focus:ring-2 focus:ring-[#D4AF37]/22"
              />
            </label>
            <label className="block min-w-0">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Display name (optional)
              </span>
              <input
                type="text"
                value={displayName}
                onChange={(ev) => setDisplayName(ev.target.value)}
                placeholder="Shown on P2P offers"
                className="mt-2 w-full rounded-xl border border-white/12 bg-black/45 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#D4AF37]/40 focus:ring-2 focus:ring-[#D4AF37]/22"
              />
            </label>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={activateImmediately}
              onChange={(ev) => setActivateImmediately(ev.target.checked)}
              className="rounded border-zinc-600 bg-black/40 accent-emerald-500"
            />
            Activate merchant immediately (skip pending queue)
          </label>

          <button
            type="submit"
            disabled={provisionBusy}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-emerald-500/18 transition hover:bg-emerald-500 disabled:opacity-50 sm:w-auto"
          >
            {provisionBusy ? "Saving…" : "Save merchant"}
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#F5E6B3]">Pending approval</h2>
        <p className="mt-2 text-xs text-zinc-500">Scroll sideways — cards match marketplace offer strip spacing.</p>

        <div className="mt-4 min-h-[120px]">
          {loadBusy ? (
            <div className="flex flex-nowrap gap-4 overflow-x-auto pb-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-36 min-w-[300px] shrink-0 animate-pulse rounded-2xl bg-white/[0.06] ring-1 ring-[#D4AF37]/10 sm:min-w-[340px]" />
              ))}
            </div>
          ) : pending.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D4AF37]/22 bg-black/25 py-14 text-center text-sm text-zinc-500 backdrop-blur-sm">
              No pending merchants.
            </div>
          ) : (
            <div className="flex flex-row flex-nowrap gap-4 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:thin] snap-x snap-mandatory [&::-webkit-scrollbar]:h-2">
              {pending.map((r) => (
                <div
                  key={r.user_id}
                  className="flex w-[min(340px,88vw)] min-w-[260px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/55 p-4 shadow-[0_12px_48px_rgba(0,0,0,0.45)] sm:min-w-[320px]"
                >
                  <p className="font-mono text-[10px] text-zinc-600">{r.user_id}</p>
                  <p className="mt-1 text-xs text-zinc-400">{r.investor_email || "(no email)"}</p>
                  <p className="mt-2 truncate text-lg font-semibold text-[#F5E6B3]">{r.display_name || "(no display name)"}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-wide text-zinc-600">
                    Registered {new Date(r.applied_at).toLocaleString()}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busyUid !== null}
                      onClick={() => void review(r.user_id, true)}
                      className="rounded-xl bg-emerald-600 px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {busyUid === r.user_id ? "…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={busyUid !== null}
                      onClick={() => void review(r.user_id, false)}
                      className="rounded-xl border border-red-500/45 px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={busyUid !== null}
                    onClick={() => void revoke(r.user_id)}
                    className="mt-2 rounded-xl border border-white/12 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-400 hover:bg-white/[0.04] disabled:opacity-50"
                  >
                    Remove access
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-[#D4AF37]/18 bg-black/35 p-5 backdrop-blur-sm sm:p-6">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#F5E6B3]">All merchants</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 [-ms-overflow-style:none] [scrollbar-width:thin]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/40 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="p-4">Email</th>
                <th className="p-4">Display name</th>
                <th className="p-4">Status</th>
                <th className="p-4">User id</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-b border-white/10 bg-black/25">
                  <td className="p-4 text-zinc-300">{r.investor_email || "—"}</td>
                  <td className="p-4 text-[#F5E6B3]">{r.display_name || "—"}</td>
                  <td className="p-4">
                    <span className="rounded-lg border border-[#D4AF37]/22 bg-black/35 px-2 py-1 text-xs capitalize text-zinc-300">
                      {r.status}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-xs text-zinc-600">{r.user_id}</td>
                  <td className="p-4">
                    {r.status !== "suspended" ? (
                      <button
                        type="button"
                        disabled={busyUid !== null}
                        onClick={() => void revoke(r.user_id)}
                        className="text-xs font-semibold uppercase tracking-wide text-red-400 hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loadBusy ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">
                    No merchant profiles yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-10 text-xs text-zinc-600">
        <Link href="/admin" className="font-semibold text-[#D4AF37] hover:text-[#F5E6B3]">
          ← Admin home
        </Link>
      </p>
    </div>
  );
}
