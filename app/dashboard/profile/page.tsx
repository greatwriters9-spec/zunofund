"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
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
      window.location.href = "/auth";
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
      <div className="min-h-screen text-white flex items-center justify-center">
        Loading profile…
      </div>
    );
  }

  if (!investor) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center p-8">
        <div className="max-w-md text-center border border-zinc-800 rounded-3xl p-10 bg-zinc-950">
          <p className="text-zinc-300 mb-6">
            No investor profile is linked to this login yet.
          </p>
          <Link
            href="/dashboard"
            className="inline-block text-yellow-500 hover:text-yellow-400 font-medium"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[460px] h-[460px] bg-yellow-500/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[380px] h-[380px] bg-yellow-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto p-5 md:p-10">
        <div className="flex items-center justify-between gap-4 mb-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-yellow-500 transition text-sm"
          >
            <ArrowLeft size={18} />
            Back to dashboard
          </Link>
        </div>

        <div className="flex items-start gap-5 mb-8">
          <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border border-yellow-500/30 bg-yellow-500/15">
            {investor.avatar_url && !avatarBroken ? (
              <Image
                key={`${investor.avatar_url}-${avatarBump}`}
                src={`${investor.avatar_url}?v=${avatarBump}`}
                alt=""
                fill
                sizes="72px"
                className="object-cover"
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <UserRound className="text-yellow-500" size={34} aria-hidden />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-yellow-500">
              Profile &amp; security
            </h1>
            <p className="text-zinc-400 mt-2 max-w-xl">
              Your account details, investor tier, and password. Tier and account status are
              managed by the platform; contact support if something looks wrong.
            </p>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Email verification</p>
            <div className="flex items-center gap-2">
              {verified ? (
                <>
                  <BadgeCheck className="text-emerald-400 shrink-0" size={22} />
                  <span className="text-emerald-300 font-medium">Verified</span>
                </>
              ) : (
                <>
                  <BadgeAlert className="text-amber-400 shrink-0" size={22} />
                  <span className="text-amber-200 font-medium">Not verified</span>
                </>
              )}
            </div>
            {!verified && (
              <p className="text-xs text-zinc-500 mt-2">
                Open the confirmation link from your signup email, then refresh this page.
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Account status</p>
            <p className="text-lg font-semibold capitalize">{statusLabel}</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Profile photo */}
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 md:p-8">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
              <Camera className="text-yellow-500" size={20} />
              Profile photo
            </h2>
            <p className="text-sm text-zinc-500 mb-5">
              JPG, PNG, WebP, or GIF — up to 5 MB. This appears on your dashboard shortcut and
              profile.
            </p>
            {photoBanner && (
              <div
                className={`mb-5 px-4 py-3 rounded-2xl text-sm border ${
                  photoBanner.type === "ok"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-red-500/50 bg-red-500/10 text-red-300"
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
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={photoBusy}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-2xl bg-yellow-500 px-5 py-3 text-sm font-bold text-black hover:bg-yellow-600 disabled:opacity-50"
              >
                {photoBusy ? (
                  <Loader2 className="animate-spin" size={18} aria-hidden />
                ) : (
                  <Camera size={18} aria-hidden />
                )}
                Upload photo
              </button>
              {investor.avatar_url ? (
                <button
                  type="button"
                  disabled={photoBusy}
                  onClick={() => void removeProfilePhoto()}
                  className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm text-zinc-300 hover:border-red-500/60 hover:text-red-300 disabled:opacity-50"
                >
                  Remove photo
                </button>
              ) : null}
            </div>
          </section>

          {/* Read-only account */}
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 md:p-8">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-5">
              <Mail className="text-yellow-500" size={20} />
              Account
            </h2>
            <dl className="space-y-4 text-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 border-b border-zinc-800/80 pb-4">
                <dt className="text-zinc-500">Login email</dt>
                <dd className="text-white font-medium break-all">{authEmail || "—"}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 border-b border-zinc-800/80 pb-4">
                <dt className="text-zinc-500 flex items-center gap-2">
                  <ShieldCheck size={14} className="text-zinc-600" />
                  Investor level
                </dt>
                <dd className="text-yellow-500 font-semibold">{planDisplay}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 pb-2">
                <dt className="text-zinc-500 flex items-center gap-2">
                  <CalendarDays size={14} className="text-zinc-600" />
                  Member since
                </dt>
                <dd className="text-white">{joinedLabel}</dd>
              </div>
            </dl>
          </section>

          {/* Editable profile */}
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 md:p-8">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-5">
              <UserRound className="text-yellow-500" size={20} />
              Personal details
            </h2>
            {profileMsg && (
              <div
                className={`mb-5 px-4 py-3 rounded-2xl text-sm border ${
                  profileMsg.type === "ok"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-red-500/50 bg-red-500/10 text-red-300"
                }`}
                role="alert"
              >
                {profileMsg.text}
              </div>
            )}
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">First name</label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-2xl bg-black border border-zinc-700 px-4 py-3 outline-none focus:border-yellow-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Middle name</label>
                  <input
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    className="w-full rounded-2xl bg-black border border-zinc-700 px-4 py-3 outline-none focus:border-yellow-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Surname</label>
                  <input
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    className="w-full rounded-2xl bg-black border border-zinc-700 px-4 py-3 outline-none focus:border-yellow-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 flex items-center gap-2">
                  <Phone size={14} />
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-2xl bg-black border border-zinc-700 px-4 py-3 outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Date of birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full rounded-2xl bg-black border border-zinc-700 px-4 py-3 outline-none focus:border-yellow-500 [color-scheme:dark]"
                />
              </div>
              <button
                type="submit"
                disabled={profileSaving}
                className="w-full sm:w-auto bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-8 rounded-2xl transition disabled:opacity-50"
              >
                {profileSaving ? "Saving…" : "Save changes"}
              </button>
            </form>
          </section>

          {/* Password */}
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 md:p-8">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
              <Lock className="text-yellow-500" size={20} />
              Security
            </h2>
            <p className="text-sm text-zinc-500 mb-5">
              Set a new password for your login. Use a unique password you do not reuse elsewhere.
            </p>
            {pwMsg && (
              <div
                className={`mb-5 px-4 py-3 rounded-2xl text-sm border ${
                  pwMsg.type === "ok"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-red-500/50 bg-red-500/10 text-red-300"
                }`}
                role="alert"
              >
                {pwMsg.text}
              </div>
            )}
            <form onSubmit={changePassword} className="space-y-4 max-w-md">
              <div className="relative">
                <input
                  type={showPw1 ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-2xl bg-black border border-zinc-700 pl-4 pr-12 py-3 outline-none focus:border-yellow-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPw1(!showPw1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-yellow-500"
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
                  className="w-full rounded-2xl bg-black border border-zinc-700 pl-4 pr-12 py-3 outline-none focus:border-yellow-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPw2(!showPw2)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-yellow-500"
                  aria-label={showPw2 ? "Hide password" : "Show password"}
                >
                  {showPw2 ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button
                type="submit"
                disabled={pwSaving}
                className="bg-zinc-100 hover:bg-white text-black font-bold py-3 px-8 rounded-2xl transition disabled:opacity-50"
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
