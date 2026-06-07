"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, Bell, Menu, UserRound, X } from "lucide-react";

import { fetchInvestorNotificationSnapshot } from "@/lib/dashboardInvestorAlerts";
import { useSupabase } from "@/lib/supabase";

export function InvestorMobileTopBar() {
  const pathname = usePathname();
  const supabase = useSupabase();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [profileAvatarBroken, setProfileAvatarBroken] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => setMobileNavOpen(false), [pathname]);

  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  const syncAlerts = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email || !user.id) return;

    const snap = await fetchInvestorNotificationSnapshot(
      supabase,
      user.id,
      user.email.trim(),
    );
    setUnreadNotificationCount(snap.unreadTotal);
  }, [supabase]);

  useEffect(() => {
    void syncAlerts();
  }, [syncAlerts, pathname]);

  useEffect(() => {
    let cancelled = false;
    async function loadAvatar() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id || cancelled) return;
      const { data } = await supabase
        .from("investors")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) setAvatarUrl((data as { avatar_url?: string | null } | null)?.avatar_url ?? null);
    }
    void loadAvatar();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    window.location.href = "/";
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[rgba(5,7,13,0.92)] px-4 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-xl supports-[backdrop-filter]:bg-[rgba(5,7,13,0.82)] lg:hidden">
        <div className="flex h-14 items-center justify-between gap-2">
          <button
            type="button"
            className="surface-panel flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.06] bg-[rgba(12,17,28,0.85)] transition hover:border-[#D4AF37]/35"
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMobileNavOpen((o) => !o)}
          >
            {mobileNavOpen ? (
              <X size={22} className="text-[#D4AF37]" aria-hidden />
            ) : (
              <Menu size={22} className="text-[#D4AF37]" aria-hidden />
            )}
          </button>

          <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
            <Image
              src="/logo.png"
              alt="Zuno"
              width={28}
              height={28}
              className="h-7 w-auto object-contain"
            />
            <span className="text-xs font-semibold tracking-[0.18em] text-white">ZUNO</span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/dashboard/profile"
              className="surface-panel flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.06] bg-[rgba(12,17,28,0.85)] transition hover:border-[#D4AF37]/35"
              aria-label="Profile and security"
            >
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/10">
                {avatarUrl && !profileAvatarBroken ? (
                  <Image
                    src={avatarUrl}
                    alt=""
                    fill
                    sizes="32px"
                    className="object-cover"
                    onError={() => setProfileAvatarBroken(true)}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <UserRound className="text-[#D4AF37]" size={18} aria-hidden />
                  </span>
                )}
              </div>
            </Link>

            <Link
              href="/notifications"
              className="surface-panel relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.06] bg-[rgba(12,17,28,0.85)] transition hover:border-[#D4AF37]/35"
              aria-label="Notifications"
            >
              <Bell className="text-[#D4AF37]" size={20} aria-hidden />
              {unreadNotificationCount > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
      </header>

      {mobileNavOpen ? (
        <div
          className="fixed inset-0 z-[210] flex flex-col bg-[#05070D] pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))] px-6 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Dashboard navigation"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06]">
            <span className="text-lg font-semibold tracking-tight text-white">Menu</span>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.06] text-[#8A93A5] transition hover:border-[#D4AF37]/30 hover:text-[#D4AF37]"
              aria-label="Close menu"
              onClick={() => setMobileNavOpen(false)}
            >
              <X size={22} aria-hidden />
            </button>
          </div>
          <nav className="mt-6 flex flex-col gap-1 text-[15px] font-medium">
            <Link
              href="/dashboard"
              className="rounded-xl px-4 py-4 text-[#8A93A5] transition hover:bg-white/[0.04] hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/p2p"
              className="flex items-center gap-3 rounded-xl px-4 py-4 text-[#8A93A5] transition hover:bg-white/[0.04] hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              <ArrowLeftRight className="h-5 w-5 shrink-0 text-[#D4AF37]" aria-hidden />
              P2P marketplace
            </Link>
            <Link
              href="/p2p/history"
              className="rounded-xl px-4 py-4 pl-12 text-[14px] text-[#8A93A5] transition hover:bg-white/[0.04] hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              P2P trade history
            </Link>
            <Link
              href="/investment-plans"
              className="rounded-xl px-4 py-4 text-[#8A93A5] transition hover:bg-white/[0.04] hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              Investments
            </Link>
            <Link
              href="/history"
              className="rounded-xl px-4 py-4 text-[#8A93A5] transition hover:bg-white/[0.04] hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              Transactions
            </Link>
            <Link
              href="/dashboard/growth"
              className="rounded-xl px-4 py-4 text-[#8A93A5] transition hover:bg-white/[0.04] hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              Analytics
            </Link>
            <Link
              href="/dashboard/profile"
              className="rounded-xl px-4 py-4 text-[#8A93A5] transition hover:bg-white/[0.04] hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              Profile & security
            </Link>
            <Link
              href="/deposit"
              className="rounded-xl px-4 py-4 text-[#8A93A5] transition hover:bg-white/[0.04] hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              Deposit
            </Link>
            <Link
              href="/withdraw"
              className="rounded-xl px-4 py-4 text-[#8A93A5] transition hover:bg-white/[0.04] hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              Withdraw
            </Link>
            <Link
              href="/support"
              className="rounded-xl px-4 py-4 text-[#8A93A5] transition hover:bg-white/[0.04] hover:text-[#D4AF37]"
              onClick={() => setMobileNavOpen(false)}
            >
              Support
            </Link>
          </nav>

          <div className="mt-auto pt-6">
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                void handleLogout();
              }}
              className="flex w-full items-center justify-center rounded-xl border border-red-500/40 bg-red-500/5 px-4 py-4 text-base font-semibold text-red-300 transition hover:border-red-500 hover:bg-red-500/10 hover:text-red-200"
            >
              Logout
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
