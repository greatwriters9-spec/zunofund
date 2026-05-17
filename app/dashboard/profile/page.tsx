"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  Phone,
  ShieldCheck,
  UserRound,
  CalendarDays,
  BadgeCheck,
  BadgeAlert,
  Camera,
  Loader2,
} from "lucide-react";

import {
  displayPlanName,
  normalizeInvestmentPlan,
} from "@/lib/investmentPlans";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";
import {
  removeInvestorAvatarFromStorage,
  uploadInvestorAvatar,
} from "@/lib/supabase/investorAvatar";

type InvestorRow = {
  id: string;
  full_name: string | null;
  avatar_url?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  surname?: string | null;
  dob?: string | null;
  phone?: string | null;
  email: string | null;
  investment_plan: string | null;
  status: string | null;
  created_at?: string | null;
};

export default function DashboardProfilePage() {
  const supabase = useSupabase();

  const [loading, setLoading] = useState(true);
  const [investor, setInvestor] = useState<InvestorRow | null>(null);
  const [authEmail, setAuthEmail] = useState<string>("");
  const [emailConfirmedAt, setEmailConfirmedAt] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [surname, setSurname] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");

  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [profileSaving, setProfileSaving] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw1, setShowPw1] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [pwSaving, setPwSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarBump, setAvatarBump] = useState(0);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoBanner, setPhotoBanner] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setProfileMsg(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      setInvestor(null);
      setLoading(false);
      window.location.href = "/";
      return;
    }

    setAuthEmail(user.email ?? "");
    setEmailConfirmedAt(user.email_confirmed_at ?? null);

    const { data, error } = await supabase
      .from("investors")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      setProfileMsg({ type: "err", text: formatSupabaseError(error) });
      setInvestor(null);
      setLoading(false);
      return;
    }

    if (!data) {
      setInvestor(null);
      setLoading(false);
      return;
    }

    const row = data as InvestorRow;
    setInvestor(row);
    setFirstName(row.first_name ?? "");
    setMiddleName(row.middle_name ?? "");
    setSurname(row.surname ?? "");
    setPhone(row.phone ?? "");
    setDob(row.dob ? String(row.dob).slice(0, 10) : "");
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    setAvatarBroken(false);
  }, [investor?.avatar_url, avatarBump]);

  const planDisplay = useMemo(() => {
    if (!investor?.investment_plan) return displayPlanName("Starter");
    return displayPlanName(normalizeInvestmentPlan(investor.investment_plan));
  }, [investor?.investment_plan]);

  const joinedLabel = useMemo(() => {
    const raw =
      investor?.created_at ??
      "";
    if (raw)
      return new Date(raw).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    return "—";
  }, [investor?.created_at]);

  const verified = Boolean(emailConfirmedAt);
  const statusLabel = (investor?.status ?? "unknown").trim() || "unknown";

  async function handleAvatarFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !investor?.id) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;

    setPhotoBanner(null);
    setPhotoBusy(true);

    try {
      const result = await uploadInvestorAvatar(supabase, user.id, file);
      if (!result.ok) {
        setPhotoBanner({ type: "err", text: result.message });
        return;
      }

      const { error } = await supabase
        .from("investors")
        .update({ avatar_url: result.publicUrl })
        .eq("user_id", user.id);

      if (error) {
        setPhotoBanner({ type: "err", text: formatSupabaseError(error) });
        return;
      }

      setAvatarBump((n) => n + 1);
      setPhotoBanner({ type: "ok", text: "Profile photo updated." });
      await loadProfile();
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removeProfilePhoto() {
    if (!investor?.id) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;

    setPhotoBanner(null);
    setPhotoBusy(true);

    try {
      await removeInvestorAvatarFromStorage(supabase, investor.avatar_url);

      const { error } = await supabase
        .from("investors")
        .update({ avatar_url: null })
        .eq("user_id", user.id);

      if (error) {
        setPhotoBanner({ type: "err", text: formatSupabaseError(error) });
        return;
      }

      setAvatarBump((n) => n + 1);
      setPhotoBanner({ type: "ok", text: "Profile photo removed." });
      await loadProfile();
    } finally {
      setPhotoBusy(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!investor?.id) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;

    setProfileSaving(true);
    setProfileMsg(null);

    const fullName = `${firstName} ${middleName} ${surname}`.replace(/\s+/g, " ").trim();

    const { error } = await supabase
      .from("investors")
      .update({
        first_name: firstName.trim() || null,
        middle_name: middleName.trim() || null,
        surname: surname.trim() || null,
        full_name: fullName.length ? fullName : investor.full_name,
        phone: phone.trim() || null,
        dob: dob ? dob : null,
      })
      .eq("user_id", user.id);

    setProfileSaving(false);

    if (error) {
      setProfileMsg({ type: "err", text: formatSupabaseError(error) });
      return;
    }

    setProfileMsg({ type: "ok", text: "Profile updated successfully." });
    await loadProfile();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);

    if (!newPassword || newPassword.length < 8) {
      setPwMsg({
        type: "err",
        text: "Use a password of at least 8 characters.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: "err", text: "Passwords do not match." });
      return;
    }

    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setPwSaving(false);

    if (error) {
      setPwMsg({ type: "err", text: formatSupabaseError(error) });
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setPwMsg({ type: "ok", text: "Password updated. Stay logged in securely on this device." });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        Loading profile…
      </div>
    );
  }

  if (!investor) {
    return (
      <div className="flex min-h-screen items-center justify-center p-5 text-white md:p-7">
        <div className="w-full max-w-md border border-zinc-800/80 bg-zinc-950/40 p-8 text-center lg:rounded-lg">
          <p className="text-sm text-zinc-400">
            No investor profile is linked to this login yet.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex text-xs font-semibold text-yellow-500 transition hover:text-yellow-400"
          >
            ← Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div className="relative z-10 mx-auto max-w-7xl p-5 md:p-7">
        <header className="mb-6 border-b border-zinc-800/80 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Account
              </p>
              <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                Profile &amp; security
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                Details you can edit, plus password. Tier and status are set by the platform —
                contact support if something looks wrong.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="shrink-0 text-xs font-semibold text-yellow-500 transition hover:text-yellow-400"
            >
              ← Dashboard
            </Link>
          </div>
        </header>

        <div className="mb-6 flex items-start gap-4">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-zinc-700/90 bg-zinc-950">
            {investor.avatar_url && !avatarBroken ? (
              <Image
                key={`${investor.avatar_url}-${avatarBump}`}
                src={`${investor.avatar_url}?v=${avatarBump}`}
                alt=""
                fill
                sizes="56px"
                className="object-cover"
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-yellow-500/10">
                <UserRound className="text-yellow-500" size={26} aria-hidden />
              </div>
            )}
          </div>
          <p className="pt-1 text-xs leading-snug text-zinc-600">
            Photo appears on your dashboard shortcut. Use the section below to upload or remove
            it.
          </p>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <div className="border border-zinc-800/80 bg-zinc-950/40 p-4 lg:rounded-lg">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Email verification
            </p>
            <div className="mt-2 flex items-center gap-2">
              {verified ? (
                <>
                  <BadgeCheck className="shrink-0 text-emerald-400" size={18} aria-hidden />
                  <span className="text-sm font-medium text-emerald-300">Verified</span>
                </>
              ) : (
                <>
                  <BadgeAlert className="shrink-0 text-amber-400" size={18} aria-hidden />
                  <span className="text-sm font-medium text-amber-200">Not verified</span>
                </>
              )}
            </div>
            {!verified && (
              <p className="mt-2 text-xs text-zinc-600">
                Open the confirmation link from your signup email, then refresh this page.
              </p>
            )}
          </div>
          <div className="border border-zinc-800/80 bg-zinc-950/40 p-4 lg:rounded-lg">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Account status
            </p>
            <p className="mt-2 text-sm font-semibold capitalize text-white">{statusLabel}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Profile photo */}
          <section className="border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5 lg:rounded-lg">
            <div className="mb-4 border-b border-zinc-800/80 pb-3">
              <h2 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Profile photo
              </h2>
              <p className="mt-1 text-xs text-zinc-600">
                JPG, PNG, WebP, or GIF — up to 5 MB.
              </p>
            </div>
            {photoBanner && (
              <div
                className={`mb-4 border px-3 py-2 text-xs ${
                  photoBanner.type === "ok"
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                    : "border-red-500/40 bg-red-500/10 text-red-300"
                }`}
                role="status"
              >
                {photoBanner.text}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarFileChange}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={photoBusy}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2.5 text-xs font-bold text-black transition hover:bg-yellow-600 disabled:opacity-50"
              >
                {photoBusy ? (
                  <Loader2 className="animate-spin" size={16} aria-hidden />
                ) : (
                  <Camera size={16} aria-hidden />
                )}
                Upload photo
              </button>
              {investor.avatar_url ? (
                <button
                  type="button"
                  disabled={photoBusy}
                  onClick={() => void removeProfilePhoto()}
                  className="rounded-lg border border-zinc-700/90 px-4 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-red-500/50 hover:text-red-300 disabled:opacity-50"
                >
                  Remove photo
                </button>
              ) : null}
            </div>
          </section>

          {/* Read-only account */}
          <section className="border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5 lg:rounded-lg">
            <div className="mb-4 border-b border-zinc-800/80 pb-3">
              <h2 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Account
              </h2>
              <p className="mt-1 text-xs text-zinc-600">Login email and tier (read-only).</p>
            </div>
            <dl className="divide-y divide-zinc-800/80 text-sm">
              <div className="flex flex-col gap-0.5 py-3 first:pt-0 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-xs text-zinc-500">Login email</dt>
                <dd className="break-all font-medium text-white">{authEmail || "—"}</dd>
              </div>
              <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="flex items-center gap-2 text-xs text-zinc-500">
                  <ShieldCheck size={12} className="text-zinc-600" aria-hidden />
                  Investor level
                </dt>
                <dd className="font-semibold text-yellow-500">{planDisplay}</dd>
              </div>
              <div className="flex flex-col gap-0.5 py-3 last:pb-0 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="flex items-center gap-2 text-xs text-zinc-500">
                  <CalendarDays size={12} className="text-zinc-600" aria-hidden />
                  Member since
                </dt>
                <dd className="text-white">{joinedLabel}</dd>
              </div>
            </dl>
          </section>

          {/* Editable profile */}
          <section className="border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5 lg:rounded-lg">
            <div className="mb-4 border-b border-zinc-800/80 pb-3">
              <h2 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Personal details
              </h2>
              <p className="mt-1 text-xs text-zinc-600">Save updates to your investor record.</p>
            </div>
            {profileMsg && (
              <div
                className={`mb-4 border px-3 py-2 text-xs ${
                  profileMsg.type === "ok"
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                    : "border-red-500/40 bg-red-500/10 text-red-300"
                }`}
                role="alert"
              >
                {profileMsg.text}
              </div>
            )}
            <form onSubmit={saveProfile} className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">First name</label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700/90 bg-black/40 px-3 py-2.5 text-sm outline-none transition focus:border-yellow-500/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">Middle name</label>
                  <input
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700/90 bg-black/40 px-3 py-2.5 text-sm outline-none transition focus:border-yellow-500/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">Surname</label>
                  <input
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700/90 bg-black/40 px-3 py-2.5 text-sm outline-none transition focus:border-yellow-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-2 text-[11px] text-zinc-500">
                  <Phone size={12} aria-hidden />
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700/90 bg-black/40 px-3 py-2.5 text-sm outline-none transition focus:border-yellow-500/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500">Date of birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700/90 bg-black/40 px-3 py-2.5 text-sm outline-none transition focus:border-yellow-500/50 [color-scheme:dark]"
                />
              </div>
              <button
                type="submit"
                disabled={profileSaving}
                className="w-full rounded-lg bg-yellow-500 px-4 py-2.5 text-xs font-bold text-black transition hover:bg-yellow-600 disabled:opacity-50 sm:w-auto"
              >
                {profileSaving ? "Saving…" : "Save changes"}
              </button>
            </form>
          </section>

          {/* Password */}
          <section className="border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5 lg:rounded-lg">
            <div className="mb-4 border-b border-zinc-800/80 pb-3">
              <h2 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Security
              </h2>
              <p className="mt-1 text-xs text-zinc-600">
                New password for this login. Use a unique password you don&apos;t reuse elsewhere.
              </p>
            </div>
            {pwMsg && (
              <div
                className={`mb-4 border px-3 py-2 text-xs ${
                  pwMsg.type === "ok"
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                    : "border-red-500/40 bg-red-500/10 text-red-300"
                }`}
                role="alert"
              >
                {pwMsg.text}
              </div>
            )}
            <form onSubmit={changePassword} className="max-w-md space-y-3">
              <div className="relative">
                <input
                  type={showPw1 ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700/90 bg-black/40 py-2.5 pl-3 pr-10 text-sm outline-none transition focus:border-yellow-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPw1(!showPw1)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-yellow-500"
                  aria-label={showPw1 ? "Hide password" : "Show password"}
                >
                  {showPw1 ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPw2 ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700/90 bg-black/40 py-2.5 pl-3 pr-10 text-sm outline-none transition focus:border-yellow-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPw2(!showPw2)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-yellow-500"
                  aria-label={showPw2 ? "Hide password" : "Show password"}
                >
                  {showPw2 ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button
                type="submit"
                disabled={pwSaving}
                className="rounded-lg border border-zinc-600 bg-zinc-100 px-4 py-2.5 text-xs font-bold text-black transition hover:bg-white disabled:opacity-50"
              >
                {pwSaving ? "Updating…" : "Update password"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
