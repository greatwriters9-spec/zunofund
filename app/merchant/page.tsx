"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { MerchantAppShell } from "@/components/merchant/MerchantAppShell";
import {
  MerchantOfferHorizontalCard,
  MerchantOffersStripHeader,
  type MerchantOfferHorizontalRow,
  type MerchantOfferQuickSavePatch,
} from "@/components/merchant/MerchantOfferHorizontalCard";
import { isBuyOfferSide } from "@/components/merchant/merchantOfferSide";
import { OffersScrollList } from "@/components/p2p/OffersScrollList";
import type { MerchantOrderCard } from "@/components/merchant/merchantOrderTypes";
import { MerchantTradesList } from "@/components/merchant/MerchantTradesList";
import { fetchMerchantOrdersWithInvestors } from "@/components/merchant/useMerchantOrders";
import { useMerchantPresenceLive } from "@/hooks/useMerchantPresenceLive";
import { fetchMerchantProfileRow } from "@/lib/merchantProfileLoad";
import {
  merchantPresenceUi,
  setMerchantPresenceMode,
  syncMerchantPresence,
  type MerchantPresenceMode,
} from "@/lib/merchantPresence";
import { expireStaleP2pOrders, P2P_CANCELLED_STATUSES } from "@/lib/p2pExpiry";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

type MerchantMainTab = "offers" | "active";
type MerchantOfferSideTab = "buy" | "sell";
type Profile = {
  user_id: string;
  display_name: string | null;
  status: string;
  is_online: boolean | null;
  last_seen_at: string | null;
  presence_mode: MerchantPresenceMode;
};

function normalizeMerchantOfferRows(raw: unknown): MerchantOfferHorizontalRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      side: String(row.side ?? ""),
      status: String(row.status ?? ""),
      min_limit: Number(row.min_limit ?? 0),
      max_limit: Number(row.max_limit ?? 0),
      rate_percentage: Number(row.rate_percentage ?? 0),
      payment_methods: Array.isArray(row.payment_methods) ? [...(row.payment_methods as string[])] : [],
      payment_instructions:
        typeof row.payment_instructions === "string" && row.payment_instructions.trim()
          ? row.payment_instructions.trim()
          : null,
      advert_message:
        typeof row.advert_message === "string" && row.advert_message.trim() ? row.advert_message.trim() : null,
      fiat_currency_code:
        typeof row.fiat_currency_code === "string" && row.fiat_currency_code.trim()
          ? row.fiat_currency_code.toUpperCase()
          : null,
    };
  });
}

/** Isolated so `MerchantDashboardPage` can wrap this in `<Suspense>` (Next.js `useSearchParams` requirement). */
function MerchantAdvMigrationBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("adv_migration") !== "1") return null;
  return (
    <div className="mb-6 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100">
      <strong className="text-amber-200">Listing saved,</strong> but your <strong>advert message was not stored</strong>{' '}
      yet — the hosted database does not expose the newer <span className="font-mono text-xs">merchant_create_offer</span>{' '}
      with <span className="font-mono text-xs">p_advert_message</span>. Apply migration{' '}
      <span className="font-mono text-[11px]">20260623120000_merchant_offers_advert_message.sql</span> (see{' '}
      <strong className="text-amber-200">docs/supabase-p2p-advert-migration.md</strong>). Then republish if you want the
      investor-facing advert saved.
    </div>
  );
}

export default function MerchantDashboardPage() {
  const supabase = useSupabase();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [sessionUserId, setSessionUserId] = useState<string | null | undefined>(undefined);
  const [offers, setOffers] = useState<MerchantOfferHorizontalRow[]>([]);
  const [activeTradeCount, setActiveTradeCount] = useState<number | null>(null);
  const [completedTradeCount, setCompletedTradeCount] = useState<number | null>(null);
  const [merchantActiveOrders, setMerchantActiveOrders] = useState<MerchantOrderCard[]>([]);
  const [activeOrdersError, setActiveOrdersError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MerchantMainTab>("offers");
  const [offerSideTab, setOfferSideTab] = useState<MerchantOfferSideTab>("sell");
  const [error, setError] = useState<string | null>(null);
  const [presenceBusy, setPresenceBusy] = useState(false);
  const [merchantAvatarUrl, setMerchantAvatarUrl] = useState<string | null>(null);
  const liveOnPage = useMerchantPresenceLive();

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setSessionUserId(null);
      setProfile(null);
      return;
    }

    setSessionUserId(user.id);

    const { profile: profLoaded, error: profErr } = await fetchMerchantProfileRow(supabase, user.id);
    if (profErr) {
      setError(formatSupabaseError({ message: profErr } as Parameters<typeof formatSupabaseError>[0]));
    }

    let prof = profLoaded;

    if (
      prof?.status === "active" &&
      prof.presence_mode === "auto" &&
      liveOnPage &&
      document.visibilityState === "visible"
    ) {
      await syncMerchantPresence(supabase, true);
      const { profile: refreshed } = await fetchMerchantProfileRow(supabase, user.id);
      if (refreshed) prof = refreshed;
    }

    setProfile(prof);

    const { data: invRow } = await supabase
      .from("investors")
      .select("avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();
    setMerchantAvatarUrl(
      typeof invRow?.avatar_url === "string" && invRow.avatar_url.trim() ? invRow.avatar_url.trim() : null,
    );

    if (prof?.status === "active") {
      await expireStaleP2pOrders(supabase);

      const [offersRes, activeTradeHead, completedTradeHead, activeFull] = await Promise.all([
        supabase
          .from("merchant_offers")
          .select("*")
          .eq("merchant_user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("merchant_orders")
          .select("id", { count: "exact", head: true })
          .eq("merchant_user_id", user.id)
          .in("status", ["pending_payment", "paid", "disputed"]),
        supabase
          .from("merchant_orders")
          .select("id", { count: "exact", head: true })
          .eq("merchant_user_id", user.id)
          .in("status", ["completed", ...P2P_CANCELLED_STATUSES]),
        fetchMerchantOrdersWithInvestors(supabase, user.id, "active"),
      ]);
      const activeC = activeTradeHead.count;
      const completedC = completedTradeHead.count;
      if (offersRes.error) {
        setError(formatSupabaseError(offersRes.error));
        setOffers([]);
      } else {
        setOffers(normalizeMerchantOfferRows(offersRes.data));
      }
      setActiveOrdersError(activeFull.error);
      setMerchantActiveOrders(activeFull.error ? [] : activeFull.orders);
      setActiveTradeCount(typeof activeC === "number" ? activeC : null);
      setCompletedTradeCount(typeof completedC === "number" ? completedC : null);
    } else {
      setOffers([]);
      setMerchantActiveOrders([]);
      setActiveOrdersError(null);
      setActiveTradeCount(null);
      setCompletedTradeCount(null);
    }
  }, [supabase, liveOnPage]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!liveOnPage || profile?.status !== "active") return;
    void load();
  }, [liveOnPage, profile?.status, load]);

  useEffect(() => {
    if (profile?.status !== "active" || !liveOnPage) return;
    const t = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(t);
  }, [load, profile?.status, liveOnPage]);

  async function toggleOffer(offerId: string, active: boolean) {
    setError(null);
    const { error: e } = await supabase.rpc("merchant_set_offer_status", {
      p_offer_id: offerId,
      p_active: active,
    });
    if (e) {
      setError(formatSupabaseError(e));
      return;
    }
    await load();
  }

  async function quickSaveOffer(offerId: string, patch: MerchantOfferQuickSavePatch): Promise<string | null> {
    const row = offers.find((o) => o.id === offerId);
    if (!row) return "Listing not found.";

    const sellSide = row.side === "sell_usdt" || row.side === "sell_btc";
    setError(null);
    const { error: e } = await supabase.rpc("merchant_update_offer", {
      p_offer_id: offerId,
      p_payment_methods: row.payment_methods.length ? row.payment_methods : ["other"],
      p_min_limit: patch.min_limit,
      p_max_limit: patch.max_limit,
      p_rate_percentage: patch.rate_percentage,
      p_payment_instructions: sellSide ? row.payment_instructions : null,
      p_advert_message: patch.advert_message,
      p_fiat_currency_code: row.fiat_currency_code ?? "USD",
    });
    if (e) {
      const msg = formatSupabaseError(e);
      setError(msg);
      return msg;
    }
    await load();
    return null;
  }

  async function deleteOffer(offerId: string) {
    const ok = confirm(
      "Permanently remove this listing?\n\n" +
        "You can delete it if there are no active trades using it " +
        "(waiting for fiat, paid awaiting release).\n\n" +
        "Trades already completed or cancelled no longer block removal.",
    );
    if (!ok) return;

    setError(null);
    const { error: e } = await supabase.rpc("merchant_delete_offer", {
      p_offer_id: offerId,
    });
    if (e) {
      setError(formatSupabaseError(e));
      return;
    }
    await load();
  }

  const inactivePanel = (
    className: string,
    inner: React.ReactNode,
    foot?: React.ReactNode,
  ) => (
    <div className={`max-w-xl rounded-2xl border border-[#D4AF37]/18 bg-black/35 p-6 backdrop-blur-sm ${className}`}>
      {inner}
      {foot}
    </div>
  );

  let body: React.ReactNode;

  if (profile === undefined || sessionUserId === undefined) {
    body = (
      <div className="flex gap-4 overflow-hidden">
        <div className="h-36 min-w-[200px] flex-1 animate-pulse rounded-2xl bg-white/[0.06]" />
        <div className="h-36 min-w-[200px] flex-1 animate-pulse rounded-2xl bg-white/[0.06]" />
      </div>
    );
  } else if (sessionUserId === null) {
    body = inactivePanel("", <p className="text-zinc-400">Sign in to open the merchant console.</p>, (
      <Link
        href="/auth"
        className="mt-5 inline-flex rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500"
      >
        Sign in
      </Link>
    ));
  } else if (profile === null) {
    body = inactivePanel("", (
      <>
        <p className="text-sm text-zinc-400">
          No merchant profile on this investor account yet. Ask an administrator to register you — public
          self-service signup is disabled.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex rounded-xl border border-white/15 bg-black/30 px-5 py-2.5 text-sm font-semibold text-zinc-300 hover:border-[#D4AF37]/35 hover:text-[#F5E6B3]"
        >
          Investor dashboard
        </Link>
      </>
    ));
  } else if (profile.status === "pending") {
    body = inactivePanel(
      "border-amber-500/25 bg-amber-950/20",
      <>
        <p className="font-semibold uppercase tracking-[0.1em] text-amber-200">Pending review</p>
        <p className="mt-3 text-sm text-zinc-400">
          Offers and settlement tools activate after an administrator approves your profile.
        </p>
        <Link
          href="/merchant/profile"
          className="mt-5 inline-flex rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-zinc-300 hover:border-[#D4AF37]/35"
        >
          Profile settings
        </Link>
      </>,
    );
  } else if (profile.status === "rejected" || profile.status === "suspended") {
    body = inactivePanel("", (
      <>
        <p className="font-medium text-[#F5E6B3]">
          Status: <strong className="uppercase">{profile.status}</strong>
        </p>
        <p className="mt-3 text-sm text-zinc-500">Contact administration for reinstatement if appropriate.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/merchant/profile"
            className="rounded-xl border border-white/15 px-5 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.04]"
          >
            Profile
          </Link>
          <Link href="/dashboard" className="rounded-xl border border-white/15 px-5 py-2.5 text-sm text-zinc-300">
            Investor dashboard
          </Link>
        </div>
      </>
    ));
  } else {
    const presenceMode = profile.presence_mode ?? "auto";
    const { showOnline: merchantOnline, label: presenceLabel } = merchantPresenceUi(
      liveOnPage,
      profile.is_online,
      profile.last_seen_at,
      presenceMode,
    );

    async function applyPresenceMode(mode: MerchantPresenceMode) {
      setPresenceBusy(true);
      setError(null);
      const { error: modeErr } = await setMerchantPresenceMode(supabase, mode);
      setPresenceBusy(false);
      if (modeErr) {
        setError(modeErr);
        return;
      }
      void load();
    }

    body = (
      <>
        <p className="mb-6 text-xs text-zinc-500 lg:hidden">
          Logged in as <span className="text-zinc-300">{profile.display_name || "Merchant"}</span>
        </p>

        <div className="mb-6 rounded-2xl border border-[#D4AF37]/18 bg-black/35 p-5 backdrop-blur-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Your visibility
          </p>
          <p
            className={`mt-2 flex items-center gap-2 text-sm font-bold ${
              merchantOnline ? "text-emerald-300" : "text-yellow-300"
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                merchantOnline
                  ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]"
                  : "bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.65)]"
              }`}
              aria-hidden
            />
            {presenceLabel}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={presenceBusy || presenceMode === "auto"}
              onClick={() => void applyPresenceMode("auto")}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-zinc-200 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Automatic
            </button>
            <button
              type="button"
              disabled={presenceBusy || presenceMode === "manual_online"}
              onClick={() => void applyPresenceMode("manual_online")}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Stay online
            </button>
            <button
              type="button"
              disabled={presenceBusy || presenceMode === "manual_offline"}
              onClick={() => void applyPresenceMode("manual_offline")}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-zinc-200 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Go offline
            </button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            <strong className="text-zinc-300">Automatic</strong> (default): buyers see you online while
            this merchant console or a P2P trade tab is open.{" "}
            <strong className="text-zinc-300">Stay online</strong> keeps you visible even when you leave.{" "}
            <strong className="text-zinc-300">Go offline</strong> hides you even while this page is open.
          </p>
        </div>

        <div className="mb-8 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#D4AF37]/18 bg-black/35 p-5 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Offers live</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-[#F5E6B3]">{offers.filter((o) => o.status === "active").length}</p>
            <div className="mt-3 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setMainTab("offers")}
                className="block text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-400 hover:text-[#F5E6B3]"
              >
                View listings ↓
              </button>
              <Link href="/merchant/offers/new" className="text-[11px] font-bold uppercase tracking-wide text-[#D4AF37] hover:text-[#F5E6B3]">
                + Publish another
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-[#D4AF37]/18 bg-black/35 p-5 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Active trades</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-[#F5E6B3]">{activeTradeCount ?? "—"}</p>
            <button
              type="button"
              onClick={() => setMainTab("active")}
              className="mt-3 block text-left text-[11px] font-bold uppercase tracking-wide text-[#D4AF37] hover:text-[#F5E6B3]"
            >
              Manage here →
            </button>
          </div>
          <div className="rounded-2xl border border-[#D4AF37]/18 bg-black/35 p-5 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Ended trades</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-[#F5E6B3]">{completedTradeCount ?? "—"}</p>
            <Link href="/merchant/orders/completed" className="mt-3 inline-block text-[11px] text-zinc-500 hover:text-zinc-300">
              History →
            </Link>
          </div>
        </div>

        <section>
          <div
            className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap"
            role="tablist"
            aria-label="Console listings and trades"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "offers"}
              className={`relative flex-1 rounded-xl border px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] transition sm:flex-none sm:min-w-[11rem] sm:py-3 sm:text-[12px] ${
                mainTab === "offers"
                  ? "border-[#D4AF37]/55 bg-black/55 text-[#F5E6B3] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-emerald-500/20"
                  : "border-white/12 bg-black/28 text-zinc-500 hover:border-[#D4AF37]/30 hover:text-zinc-300"
              }`}
              onClick={() => setMainTab("offers")}
            >
              Your offers
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "active"}
              className={`relative flex-1 rounded-xl border px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] transition sm:flex-none sm:min-w-[11rem] sm:py-3 sm:text-[12px] ${
                mainTab === "active"
                  ? "border-[#D4AF37]/55 bg-black/55 text-[#F5E6B3] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-emerald-500/20"
                  : "border-white/12 bg-black/28 text-zinc-500 hover:border-[#D4AF37]/30 hover:text-zinc-300"
              }`}
              onClick={() => setMainTab("active")}
            >
              Active trades
            </button>
          </div>

          <div className="min-h-0 min-w-full">
            {mainTab === "offers" ? (
              <>
                {offers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#D4AF37]/22 bg-black/25 py-14 text-center text-sm text-zinc-500">
                    No offers yet —{" "}
                    <Link href="/merchant/offers/new" className="font-semibold text-[#D4AF37] hover:underline">
                      publish your first
                    </Link>
                    .
                  </div>
                ) : (
                  <>
                    <div
                      className="mb-3 flex gap-2"
                      role="tablist"
                      aria-label="Buy and sell listings"
                    >
                      {(
                        [
                          { id: "sell" as const, label: "Sell offers" },
                          { id: "buy" as const, label: "Buy offers" },
                        ] as const
                      ).map(({ id, label }) => {
                        const count = offers.filter((o) =>
                          id === "buy" ? isBuyOfferSide(o.side) : !isBuyOfferSide(o.side),
                        ).length;
                        const selected = offerSideTab === id;
                        const isSell = id === "sell";
                        const sideTabCls = selected
                          ? isSell
                            ? "border-red-500/22 bg-red-950/35 text-red-100/95 shadow-[0_0_22px_rgba(220,38,38,0.14),inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-red-500/18"
                            : "border-emerald-500/22 bg-emerald-950/30 text-emerald-100/95 shadow-[0_0_22px_rgba(16,185,129,0.14),inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-emerald-500/18"
                          : isSell
                            ? "border-red-500/10 bg-black/28 text-zinc-500 shadow-[0_0_12px_rgba(220,38,38,0.05)] hover:border-red-500/18 hover:bg-red-950/20 hover:text-red-200/80"
                            : "border-emerald-500/10 bg-black/28 text-zinc-500 shadow-[0_0_12px_rgba(16,185,129,0.05)] hover:border-emerald-500/18 hover:bg-emerald-950/20 hover:text-emerald-200/80";
                        const countCls = selected
                          ? isSell
                            ? "text-red-300/55"
                            : "text-emerald-300/55"
                          : "text-zinc-600";
                        return (
                          <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => setOfferSideTab(id)}
                            className={`flex-1 rounded-xl border px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.12em] transition duration-200 sm:flex-none sm:min-w-[9.5rem] sm:text-[11px] ${sideTabCls}`}
                          >
                            {label}
                            <span className={`ml-1.5 tabular-nums ${countCls}`}>({count})</span>
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      const filtered = offers.filter((o) =>
                        offerSideTab === "buy" ? isBuyOfferSide(o.side) : !isBuyOfferSide(o.side),
                      );
                      if (filtered.length === 0) {
                        return (
                          <div className="rounded-2xl border border-dashed border-[#D4AF37]/22 bg-black/25 py-12 text-center text-sm text-zinc-500">
                            No {offerSideTab === "buy" ? "buy" : "sell"} offers yet —{" "}
                            <Link
                              href="/merchant/offers/new"
                              className="font-semibold text-[#D4AF37] hover:underline"
                            >
                              publish one
                            </Link>
                            .
                          </div>
                        );
                      }
                      return (
                        <OffersScrollList stripLayout>
                          <MerchantOffersStripHeader />
                          {filtered.map((o) => (
                            <MerchantOfferHorizontalCard
                              key={o.id}
                              offer={o}
                              merchantAvatarUrl={merchantAvatarUrl}
                              merchantDisplayName={profile?.display_name}
                              onToggleActive={() => void toggleOffer(o.id, o.status !== "active")}
                              onDelete={() => void deleteOffer(o.id)}
                              onQuickSave={quickSaveOffer}
                            />
                          ))}
                        </OffersScrollList>
                      );
                    })()}
                  </>
                )}
              </>
            ) : (
              <div className="max-h-[min(60vh,calc(100vh-14rem))] overflow-y-auto pr-1 pb-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2">
                {activeOrdersError ? (
                  <div className="mb-4 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {activeOrdersError}
                  </div>
                ) : null}
                <MerchantTradesList
                  variant="console"
                  orders={merchantActiveOrders}
                  emptyMessage="No active trades. When investors open tickets on your ads, they appear here — same panel as your offers."
                />
              </div>
            )}
          </div>
        </section>

        <p className="mt-10 text-[11px] leading-relaxed text-zinc-600">
          Dedicated pages still available:{" "}
          <Link href="/merchant/orders/active" className="text-[#D4AF37] hover:text-[#F5E6B3]">
            Active trades
          </Link>{" "}
          ·{" "}
          <Link href="/merchant/orders/completed" className="text-[#D4AF37] hover:text-[#F5E6B3]">
            Completed trades
          </Link>
          .
        </p>
      </>
    );
  }

  return (
    <MerchantAppShell
      heading="Console"
      description="Same glass-and-glow rails as investor P2P · switch Your offers / Active trades in one lane without leaving home."
      merchantStatus={profile?.status ?? null}
    >
      <Suspense fallback={null}>
        <MerchantAdvMigrationBanner />
      </Suspense>
      {error ? (
        <div className="mb-6 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}
      {body}
    </MerchantAppShell>
  );
}
