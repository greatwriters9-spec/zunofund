"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { formatSupabaseError, useSupabase } from "@/lib/supabase";

type Mp = {
  user_id: string;
  display_name: string | null;
  status: string;
};

export default function MerchantProfilePage() {
  const supabase = useSupabase();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Mp | null>(null);
  const [authEmail, setAuthEmail] = useState("");

  const [username, setUsername] = useState("");
  const [userBusy, setUserBusy] = useState(false);
  const [userMsg, setUserMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw1, setShowPw1] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setUserMsg(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      setProfile(null);
      setAuthEmail("");
      setLoading(false);
      return;
    }

    setAuthEmail(user.email ?? "");

    const { data: mp, error } = await supabase
      .from("merchant_profiles")
      .select("user_id, display_name, status")
      .eq("user_id", user.id)
      .maybeSingle();

    setLoading(false);

    if (error) {
      setUserMsg({ kind: "err", text: formatSupabaseError(error) });
      setProfile(null);
      return;
    }

    const row = mp as Mp | null;
    setProfile(row);
    setUsername(row?.display_name ?? "");
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveUsername(e: React.FormEvent) {
    e.preventDefault();
    setUserMsg(null);
    if (!profile || !["pending", "active"].includes(profile.status)) {
      setUserMsg({ kind: "err", text: "You cannot update this profile status." });
      return;
    }

    setUserBusy(true);
    const { error } = await supabase.rpc("merchant_update_display_name", {
      p_display_name: username.trim() || null,
    });
    setUserBusy(false);

    if (error) {
      setUserMsg({ kind: "err", text: formatSupabaseError(error) });
      return;
    }

    setUserMsg({
      kind: "ok",
      text: "Marketplace name updated. Investors see this on your offers.",
    });
    await load();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);

    if (!newPassword || newPassword.length < 8) {
      setPwMsg({ kind: "err", text: "Use a password of at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ kind: "err", text: "Passwords do not match." });
      return;
    }

    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwBusy(false);

    if (error) {
      setPwMsg({ kind: "err", text: formatSupabaseError(error) });
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setPwMsg({ kind: "ok", text: "Password updated." });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500">
        Loading…
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <div className="mx-auto max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8">
          <p className="text-zinc-400">No merchant profile on this account.</p>
          <Link href="/merchant" className="mt-6 inline-block text-yellow-500 hover:underline">
            ← Merchant home
          </Link>
        </div>
      </main>
    );
  }

  const canEditUsername = profile.status === "pending" || profile.status === "active";

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-lg">
        <h1 className="text-3xl font-bold text-yellow-500">Merchant profile</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Sign-in email: <span className="text-zinc-300">{authEmail || "—"}</span>
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Status: <span className="capitalize text-zinc-300">{profile.status}</span>
        </p>

        {!canEditUsername ? (
          <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Your merchant access is not active. Contact support if this is unexpected.
          </p>
        ) : null}

        <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-lg font-semibold">Marketplace name</h2>
          <p className="mt-1 text-sm text-zinc-500">
            This is the name investors see when browsing P2P offers (not your legal investor name).
          </p>

          <form onSubmit={(ev) => void saveUsername(ev)} className="mt-4 space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-zinc-500">Display name</span>
              <input
                type="text"
                disabled={!canEditUsername || userBusy}
                value={username}
                onChange={(ev) => setUsername(ev.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-black px-4 py-2 text-sm outline-none focus:border-yellow-500 disabled:opacity-50"
              />
            </label>
            {userMsg ? (
              <p
                className={
                  userMsg.kind === "ok" ? "text-sm text-green-400" : "text-sm text-red-400"
                }
              >
                {userMsg.text}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={!canEditUsername || userBusy}
              className="rounded-xl bg-yellow-500 px-5 py-2 text-sm font-bold text-black hover:bg-yellow-400 disabled:opacity-50"
            >
              {userBusy ? "Saving…" : "Save name"}
            </button>
          </form>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-lg font-semibold">Password</h2>
          <p className="mt-1 text-sm text-zinc-500">Change the password for this merchant login.</p>

          <form onSubmit={(ev) => void changePassword(ev)} className="mt-4 space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-zinc-500">New password</span>
              <div className="relative mt-1">
                <input
                  type={showPw1 ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(ev) => setNewPassword(ev.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-2 pr-12 text-sm outline-none focus:border-yellow-500"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  onClick={() => setShowPw1((v) => !v)}
                  aria-label={showPw1 ? "Hide password" : "Show password"}
                >
                  {showPw1 ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-zinc-500">Confirm password</span>
              <div className="relative mt-1">
                <input
                  type={showPw2 ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(ev) => setConfirmPassword(ev.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-2 pr-12 text-sm outline-none focus:border-yellow-500"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  onClick={() => setShowPw2((v) => !v)}
                  aria-label={showPw2 ? "Hide password" : "Show password"}
                >
                  {showPw2 ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {pwMsg ? (
              <p className={pwMsg.kind === "ok" ? "text-sm text-green-400" : "text-sm text-red-400"}>
                {pwMsg.text}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pwBusy}
              className="rounded-xl border border-zinc-600 px-5 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              {pwBusy ? "Updating…" : "Update password"}
            </button>
          </form>
        </section>

        <p className="mt-8 text-sm text-zinc-500">
          Legal name, phone, and investor profile:{" "}
          <Link href="/dashboard/profile" className="text-yellow-500 hover:underline">
            Investor profile
          </Link>
        </p>

        <Link href="/merchant" className="mt-4 inline-block text-sm text-yellow-600 hover:underline">
          ← Merchant dashboard
        </Link>
      </div>
    </main>
  );
}
