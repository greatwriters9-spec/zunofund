"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
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

import { DASHBOARD_CARD, DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";

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

const fieldClass =
  "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#D4AF37]/40 focus:ring-1 focus:ring-[#D4AF37]/20";

const primaryBtnClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F7E3A0] via-[#D4AF37] to-[#EAC54F] px-4 py-2.5 text-xs font-bold text-black shadow-[0_0_20px_rgba(212,175,55,0.2)] transition hover:brightness-105 disabled:opacity-50";

const secondaryBtnClass =
  "rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-zinc-100 transition hover:border-white/[0.2] disabled:opacity-50";

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4 border-b border-white/[0.06] pb-3">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
        {title}
      </h2>
      <p className="mt-1 text-xs" style={{ color: DASHBOARD_MUTED }}>
        {description}
      </p>
    </div>
  );
}

function StatusBanner({
  type,
  text,
}: {
  type: "ok" | "err";
  text: string;
}) {
  return (
    <div
      className={`mb-4 rounded-xl border px-3 py-2 text-xs ${
        type === "ok"
          ? "border-[#00C076]/30 bg-[#00C076]/10 text-emerald-200"
          : "border-red-500/30 bg-red-500/10 text-red-300"
      }`}
      role={type === "ok" ? "status" : "alert"}
    >
      {text}
    </div>
  );
}

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
      <div className="relative min-h-full bg-[#05070D] text-white">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,rgba(212,175,55,0.08)_0%,transparent_70%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-[1400px] px-4 py-14 text-center sm:px-6">
          <p className="text-sm" style={{ color: DASHBOARD_MUTED }}>
            Loading profile…
          </p>
        </div>
      </div>
    );
  }

  if (!investor) {
    return (
      <div className="relative min-h-full bg-[#05070D] text-white">
        <div className="relative mx-auto max-w-[1400px] px-4 py-14 sm:px-6">
          <div className={`${DASHBOARD_CARD} mx-auto max-w-md p-8 text-center`}>
            <p className="text-sm" style={{ color: DASHBOARD_MUTED }}>
              No investor profile is linked to this login yet.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[#D4AF37] transition hover:text-[#F5E6B3]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full bg-[#05070D] text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,rgba(212,175,55,0.08)_0%,transparent_70%)]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-[1400px] space-y-5 px-4 py-5 pb-6 sm:space-y-6 sm:px-6 sm:pb-8 lg:py-8">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-[#D4AF37]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Dashboard
          </Link>

          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
              Account
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
              Profile &amp; security
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
              Details you can edit, plus password. Tier and status are set by the platform —
              contact support if something looks wrong.
            </p>
          </div>
        </motion.header>

        <div className="flex items-start gap-4">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 ring-1 ring-white/[0.06]">
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
              <div className="flex h-full w-full items-center justify-center">
                <UserRound className="text-[#D4AF37]" size={26} aria-hidden />
              </div>
            )}
          </div>
          <p className="pt-1 text-xs leading-snug" style={{ color: DASHBOARD_MUTED }}>
            Photo appears on your dashboard shortcut. Use the section below to upload or remove it.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className={`${DASHBOARD_CARD} p-4`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: DASHBOARD_MUTED }}>
              Email verification
            </p>
            <div className="mt-2 flex items-center gap-2">
              {verified ? (
                <>
                  <BadgeCheck className="shrink-0 text-[#00C076]" size={18} aria-hidden />
                  <span className="text-sm font-medium text-[#00C076]">Verified</span>
                </>
              ) : (
                <>
                  <BadgeAlert className="shrink-0 text-[#D4AF37]" size={18} aria-hidden />
                  <span className="text-sm font-medium text-[#F5E6B3]">Not verified</span>
                </>
              )}
            </div>
            {!verified && (
              <p className="mt-2 text-xs" style={{ color: DASHBOARD_MUTED }}>
                Open the confirmation link from your signup email, then refresh this page.
              </p>
            )}
          </div>
          <div className={`${DASHBOARD_CARD} p-4`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: DASHBOARD_MUTED }}>
              Account status
            </p>
            <p className="mt-2 text-sm font-semibold capitalize text-white">{statusLabel}</p>
          </div>
        </div>

        <div className="space-y-4">
          <section className={`${DASHBOARD_CARD} p-4 sm:p-5`}>
            <SectionHeader
              title="Profile photo"
              description="JPG, PNG, WebP, or GIF — up to 5 MB."
            />
            {photoBanner ? <StatusBanner type={photoBanner.type} text={photoBanner.text} /> : null}
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
                className={primaryBtnClass}
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
                  className={`${secondaryBtnClass} hover:border-red-500/40 hover:text-red-300`}
                >
                  Remove photo
                </button>
              ) : null}
            </div>
          </section>

          <section className={`${DASHBOARD_CARD} p-4 sm:p-5`}>
            <SectionHeader title="Account" description="Login email and tier (read-only)." />
            <dl className="divide-y divide-white/[0.04] text-sm">
              <div className="flex flex-col gap-0.5 py-3 first:pt-0 sm:flex-row sm:justify-between sm:gap-4">
                <dt style={{ color: DASHBOARD_MUTED }} className="text-xs">
                  Login email
                </dt>
                <dd className="break-all font-medium text-white">{authEmail || "—"}</dd>
              </div>
              <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="flex items-center gap-2 text-xs" style={{ color: DASHBOARD_MUTED }}>
                  <ShieldCheck size={12} aria-hidden />
                  Investor level
                </dt>
                <dd className="font-semibold text-[#D4AF37]">{planDisplay}</dd>
              </div>
              <div className="flex flex-col gap-0.5 py-3 last:pb-0 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="flex items-center gap-2 text-xs" style={{ color: DASHBOARD_MUTED }}>
                  <CalendarDays size={12} aria-hidden />
                  Member since
                </dt>
                <dd className="text-white">{joinedLabel}</dd>
              </div>
            </dl>
          </section>

          <section className={`${DASHBOARD_CARD} p-4 sm:p-5`}>
            <SectionHeader
              title="Personal details"
              description="Save updates to your investor record."
            />
            {profileMsg ? <StatusBanner type={profileMsg.type} text={profileMsg.text} /> : null}
            <form onSubmit={saveProfile} className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium" style={{ color: DASHBOARD_MUTED }}>
                    First name
                  </label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium" style={{ color: DASHBOARD_MUTED }}>
                    Middle name
                  </label>
                  <input
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium" style={{ color: DASHBOARD_MUTED }}>
                    Surname
                  </label>
                  <input
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-2 text-[11px] font-medium" style={{ color: DASHBOARD_MUTED }}>
                  <Phone size={12} aria-hidden />
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium" style={{ color: DASHBOARD_MUTED }}>
                  Date of birth
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className={`${fieldClass} [color-scheme:dark]`}
                />
              </div>
              <button type="submit" disabled={profileSaving} className={`${primaryBtnClass} w-full sm:w-auto`}>
                {profileSaving ? "Saving…" : "Save changes"}
              </button>
            </form>
          </section>

          <section className={`${DASHBOARD_CARD} p-4 sm:p-5`}>
            <SectionHeader
              title="Security"
              description="New password for this login. Use a unique password you don't reuse elsewhere."
            />
            {pwMsg ? <StatusBanner type={pwMsg.type} text={pwMsg.text} /> : null}
            <form onSubmit={changePassword} className="max-w-md space-y-3">
              <div className="relative">
                <input
                  type={showPw1 ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`${fieldClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw1(!showPw1)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-[#D4AF37]"
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
                  className={`${fieldClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw2(!showPw2)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-[#D4AF37]"
                  aria-label={showPw2 ? "Hide password" : "Show password"}
                >
                  {showPw2 ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button type="submit" disabled={pwSaving} className={secondaryBtnClass}>
                {pwSaving ? "Updating…" : "Update password"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
