"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { MerchantAppShell } from "@/components/merchant/MerchantAppShell";
import {
  MERCHANT_CARD,
  MERCHANT_GHOST_BTN,
  MERCHANT_MUTED,
  MERCHANT_PRIMARY_BTN,
  MERCHANT_SECTION_LABEL,
} from "@/components/merchant/merchantStyles";
import {
  MerchantConsoleStickyNav,
  type MerchantConsoleSection,
} from "@/components/merchant/MerchantConsoleStickyNav";
import {
  MerchantOfferHorizontalCard,
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
  const [merchantCompletedOrders, setMerchantCompletedOrders] = useState<MerchantOrderCard[]>([]);
  const [activeOrdersError, setActiveOrdersError] = useState<string | null>(null);
  const [completedOrdersError, setCompletedOrdersError] = useState<string | null>(null);
  const [consoleSection, setConsoleSection] = useState<MerchantConsoleSection>("offers");
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

      const [offersRes, activeTradeHead, completedTradeHead, activeFull, completedFull] = await Promise.all([
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
        fetchMerchantOrdersWithInvestors(supabase, user.id, "completed"),
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
      setCompletedOrdersError(completedFull.error);
      setMerchantCompletedOrders(completedFull.error ? [] : completedFull.orders);
      setActiveTradeCount(typeof activeC === "number" ? activeC : null);
      setCompletedTradeCount(typeof completedC === "number" ? completedC : null);
    } else {
      setOffers([]);
      setMerchantActiveOrders([]);
      setMerchantCompletedOrders([]);
      setActiveOrdersError(null);
      setCompletedOrdersError(null);
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
    <div className={`max-w-xl ${MERCHANT_CARD} p-6 ${className}`}>
      {inner}
      {foot}
    </div>
  );

  let body: React.ReactNode;

  if (profile === undefined || sessionUserId === undefined) {
    body = (
      <div className="flex gap-4 overflow-hidden">
        <div className={`h-36 min-w-[200px] flex-1 animate-pulse ${MERCHANT_CARD}`} />
        <div className={`h-36 min-w-[200px] flex-1 animate-pulse ${MERCHANT_CARD}`} />
      </div>
    );
  } else if (sessionUserId === null) {
    body = inactivePanel("", <p style={{ color: MERCHANT_MUTED }}>Sign in to open the merchant console.</p>, (
      <Link href="/auth" className={`mt-5 ${MERCHANT_PRIMARY_BTN}`}>
        Sign in
      </Link>
    ));
  } else if (profile === null) {
    body = inactivePanel("", (
      <>
        <p className="text-sm" style={{ color: MERCHANT_MUTED }}>
          No merchant profile on this investor account yet. Ask an administrator to register you — public
          self-service signup is disabled.
        </p>
        <Link href="/dashboard" className={`mt-5 ${MERCHANT_GHOST_BTN}`}>
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
        <Link href="/merchant/profile" className={`mt-5 ${MERCHANT_GHOST_BTN}`}>
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
          <Link href="/merchant/profile" className={MERCHANT_GHOST_BTN}>
            Profile
          </Link>
          <Link href="/dashboard" className={MERCHANT_GHOST_BTN}>
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
        {consoleSection === "visibility" ? (
        <div className={`${MERCHANT_CARD} p-5`}>
          <p className={MERCHANT_SECTION_LABEL}>
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
          <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:gap-2">
            <button
              type="button"
              disabled={presenceBusy || presenceMode === "auto"}
              onClick={() => void applyPresenceMode("auto")}
              className="min-h-[44px] touch-manipulation rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-zinc-200 transition hover:border-[#D4AF37]/30 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              Automatic
            </button>
            <button
              type="button"
              disabled={presenceBusy || presenceMode === "manual_online"}
              onClick={() => void applyPresenceMode("manual_online")}
              className="min-h-[44px] touch-manipulation rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-[0_0_20px_rgba(16,185,129,0.2)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              Stay online
            </button>
            <button
              type="button"
              disabled={presenceBusy || presenceMode === "manual_offline"}
              onClick={() => void applyPresenceMode("manual_offline")}
              className="min-h-[44px] touch-manipulation rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-zinc-200 transition hover:border-[#D4AF37]/30 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              Go offline
            </button>
          </div>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: MERCHANT_MUTED }}>
            <strong className="text-zinc-300">Automatic</strong> (default): buyers see you online while
            this merchant console or a P2P trade tab is open.{" "}
            <strong className="text-zinc-300">Stay online</strong> keeps you visible even when you leave.{" "}
            <strong className="text-zinc-300">Go offline</strong> hides you even while this page is open.
          </p>
        </div>
        ) : null}

        <section className="min-h-0 min-w-full">
            {consoleSection === "offers" ? (
              <>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <p className={MERCHANT_SECTION_LABEL}>
                    Live listings
                  </p>
                  <Link
                    href="/merchant/offers/new"
                    className={`min-h-[44px] w-full sm:w-auto ${MERCHANT_PRIMARY_BTN}`}
                  >
                    + New offer
                  </Link>
                </div>
                {offers.length === 0 ? (
                  <div className={`${MERCHANT_CARD} border-dashed py-14 text-center text-sm`} style={{ color: MERCHANT_MUTED }}>
                    No offers yet —{" "}
                    <Link href="/merchant/offers/new" className="font-semibold text-[#D4AF37] hover:underline">
                      publish your first
                    </Link>
                    .
                  </div>
                ) : (
                  <>
                    <div
                      className="mb-3 flex flex-wrap gap-2 max-sm:grid max-sm:grid-cols-2 max-sm:w-full"
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
                            className={`flex-1 touch-manipulation rounded-xl border px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.12em] transition duration-200 max-sm:min-h-[44px] sm:flex-none sm:min-w-[9.5rem] sm:text-[11px] ${sideTabCls}`}
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
                          <div className={`${MERCHANT_CARD} border-dashed py-12 text-center text-sm`} style={{ color: MERCHANT_MUTED }}>
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
                        <div className="-mx-4 border-t border-white/[0.06] sm:-mx-6">
                          <OffersScrollList fullPage>
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
                        </div>
                      );
                    })()}
                  </>
                )}
              </>
            ) : consoleSection === "active" ? (
              <div className="max-lg:overflow-visible lg:max-h-[min(60vh,calc(100vh-14rem))] lg:overflow-y-auto lg:pr-1 lg:pb-2 [scrollbar-width:thin] lg:[&::-webkit-scrollbar]:w-2">
                {activeOrdersError ? (
                  <div className="mb-4 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {activeOrdersError}
                  </div>
                ) : null}
                <MerchantTradesList
                  variant="console"
                  orders={merchantActiveOrders}
                  emptyMessage="No active trades. When investors open tickets on your ads, they appear here."
                />
              </div>
            ) : consoleSection === "completed" ? (
              <div className="max-lg:overflow-visible lg:max-h-[min(60vh,calc(100vh-14rem))] lg:overflow-y-auto lg:pr-1 lg:pb-2 [scrollbar-width:thin] lg:[&::-webkit-scrollbar]:w-2">
                {completedOrdersError ? (
                  <div className="mb-4 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {completedOrdersError}
                  </div>
                ) : null}
                <MerchantTradesList
                  variant="console"
                  orders={merchantCompletedOrders}
                  emptyMessage="No completed or cancelled trades yet."
                />
              </div>
            ) : null}
        </section>

        <p className="mt-8 hidden text-[11px] leading-relaxed lg:block" style={{ color: MERCHANT_MUTED }}>
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

  const showConsoleNav = profile?.status === "active";

  return (
    <MerchantAppShell merchantStatus={profile?.status ?? null}>
      <Suspense fallback={null}>
        <MerchantAdvMigrationBanner />
      </Suspense>
      {showConsoleNav ? (
        <MerchantConsoleStickyNav
          section={consoleSection}
          onSectionChange={setConsoleSection}
          counts={{
            offers: offers.filter((o) => o.status === "active").length,
            active: activeTradeCount,
            completed: completedTradeCount,
          }}
        />
      ) : null}
      {error ? (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200/95 backdrop-blur-sm">{error}</div>
      ) : null}
      {body}
    </MerchantAppShell>
  );
}
