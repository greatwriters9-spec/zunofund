"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { MerchantBadge } from "@/components/p2p/MerchantBadge";
import { MerchantOfferAvatar } from "@/components/p2p/MerchantOfferAvatar";
import { MerchantReviewList } from "@/components/p2p/MerchantReviewList";
import { formatMerchantCountry } from "@/lib/merchantCountries";
import { ratingStars } from "@/lib/merchantBadges";
import { formatInvestorMerchantPresence } from "@/lib/merchantPresence";
import type { MerchantPublicProfile, MerchantReviewRow } from "@/lib/merchantReputation";
import { formatMinutesLabel } from "@/lib/merchantReputation";
import { formatFiat } from "@/lib/currencies";
import { formatUsdLocale } from "@/lib/formatMoney";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

const PROFILE_OFFERS_PREVIEW_LIMIT = 3;

type ActiveOfferRow = {
  offer_id: string;
  side: string;
  payment_methods: string[];
  min_limit: number;
  max_limit: number;
  rate_percentage: number;
  fiat_currency_code: string;
  advert_message: string | null;
};

type MerchantPublicProfileViewProps = {
  merchantId: string;
};

export function MerchantPublicProfileView({ merchantId }: MerchantPublicProfileViewProps) {
  const supabase = useSupabase();
  const [profile, setProfile] = useState<MerchantPublicProfile | null>(null);
  const [reviews, setReviews] = useState<MerchantReviewRow[]>([]);
  const [offers, setOffers] = useState<ActiveOfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [profileRes, reviewsRes, offersRes] = await Promise.all([
      supabase.rpc("investor_get_merchant_public_profile", { p_merchant_user_id: merchantId }),
      supabase.rpc("investor_list_merchant_reviews", { p_merchant_user_id: merchantId, p_limit: 20 }),
      supabase.rpc("investor_get_merchant_active_offers", { p_merchant_user_id: merchantId }),
    ]);

    setLoading(false);

    if (profileRes.error) {
      setError(formatSupabaseError(profileRes.error));
      return;
    }

    const p = (Array.isArray(profileRes.data) ? profileRes.data[0] : profileRes.data) as
      | MerchantPublicProfile
      | undefined;
    if (!p) {
      setError("Merchant not found or not active.");
      setProfile(null);
      return;
    }

    setProfile(p);
    setReviews((reviewsRes.data as MerchantReviewRow[]) ?? []);
    setOffers((offersRes.data as ActiveOfferRow[]) ?? []);
  }, [merchantId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const presence = profile
    ? formatInvestorMerchantPresence(profile.is_online, profile.last_seen_at, profile.presence_mode)
    : null;

  if (loading) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center text-zinc-500">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-8 text-center">
        <p className="text-red-200">{error ?? "Merchant not found."}</p>
        <Link href="/p2p" className="mt-4 inline-block text-sm font-semibold text-[#D4AF37] hover:underline">
          ← Back to P2P marketplace
        </Link>
      </div>
    );
  }

  const name = profile.display_name?.trim() || "Merchant";
  const countryLabel = formatMerchantCountry(profile.country);
  const rating = Number(profile.rating) || 0;
  const pct = Number(profile.positive_feedback_percent) || 0;
  const trades = Number(profile.total_trades) || 0;
  const completion = Number(profile.completion_rate) || 0;
  const previewOffers = offers.slice(0, PROFILE_OFFERS_PREVIEW_LIMIT);
  const moreOffersCount = Math.max(0, offers.length - PROFILE_OFFERS_PREVIEW_LIMIT);

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <div>
        <Link href="/p2p" className="text-sm font-semibold text-[#D4AF37] hover:text-[#F5E6B3] hover:underline">
          ← P2P marketplace
        </Link>
      </div>

      <header className="rounded-2xl border border-[#D4AF37]/18 bg-gradient-to-b from-white/[0.04] to-black/55 p-6 shadow-[0_12px_48px_rgba(0,0,0,0.45)] sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <MerchantOfferAvatar
            avatarUrl={profile.avatar_url}
            displayName={name}
            size="md"
            className="h-20 w-20 text-lg ring-2 ring-[#D4AF37]/35 sm:h-24 sm:w-24"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{name}</h1>
            {countryLabel ? <p className="mt-2 text-sm text-zinc-400">{countryLabel}</p> : null}
            <div className="mt-3">
              <MerchantBadge slug={profile.badge_slug} size="md" />
            </div>
            {presence ? (
              <p
                className={`mt-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${
                  presence.online ? "text-emerald-300" : "text-yellow-300"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${presence.online ? "bg-emerald-400" : "bg-yellow-400"}`}
                  aria-hidden
                />
                {presence.primary}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <p className="text-lg tracking-wide text-[#D4AF37]">
                {ratingStars(rating)}{" "}
                <span className="text-base font-semibold tabular-nums text-white">
                  {rating > 0 ? rating.toFixed(1) : "—"}
                </span>
              </p>
              {pct > 0 ? (
                <p className="text-sm font-semibold text-emerald-300/90">{pct.toFixed(1)}% Positive Feedback</p>
              ) : null}
              {trades > 0 ? (
                <p className="text-sm tabular-nums text-zinc-400">{trades.toLocaleString()} Trades</p>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Completion rate", value: completion > 0 ? `${completion.toFixed(1)}%` : "—" },
          {
            label: "Member since",
            value: profile.member_since
              ? new Date(profile.member_since).toLocaleDateString(undefined, { month: "short", year: "numeric" })
              : "—",
          },
          { label: "Avg. release time", value: formatMinutesLabel(profile.avg_release_time_minutes) },
          { label: "Avg. payment time", value: formatMinutesLabel(profile.avg_payment_time_minutes) },
          {
            label: "Total volume",
            value:
              Number(profile.total_volume_traded) > 0
                ? formatUsdLocale(Number(profile.total_volume_traded))
                : "—",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-white/[0.06] bg-[rgba(12,17,28,0.85)] px-4 py-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{stat.label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-[#F5E6B3]">{stat.value}</p>
          </div>
        ))}
      </section>

      {profile.about_merchant?.trim() ? (
        <section className="rounded-2xl border border-white/[0.06] bg-black/35 p-6">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#F5E6B3]">About merchant</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
            {profile.about_merchant.trim()}
          </p>
        </section>
      ) : null}

      {previewOffers.length > 0 ? (
        <section className="rounded-2xl border border-white/[0.06] bg-black/35 p-6">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#F5E6B3]">Active offers</h2>
          <ul className="mt-4 space-y-3">
            {previewOffers.map((o) => {
              const fiat = (o.fiat_currency_code || "USD").toUpperCase();
              const flow = o.side.startsWith("sell") ? "buy" : "sell";
              const href = `/p2p/${flow}`;
              return (
                <li key={o.offer_id}>
                  <Link
                    href={href}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3 transition hover:border-[#D4AF37]/35"
                  >
                    <div>
                      <p className="text-sm font-semibold capitalize text-white">
                        {o.side.replace(/_/g, " ")}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatFiat(Number(o.min_limit), fiat)} – {formatFiat(Number(o.max_limit), fiat)} · Fee{" "}
                        {Number(o.rate_percentage)}%
                      </p>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wide text-[#D4AF37]">Trade →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {moreOffersCount > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-white/[0.06] pt-4">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-3 py-1.5 text-xs font-semibold text-[#F5E6B3]"
                aria-label={`${moreOffersCount} more offers available`}
              >
                <span className="text-[#D4AF37]" aria-hidden>
                  +
                </span>
                {moreOffersCount} more offer{moreOffersCount === 1 ? "" : "s"}
              </span>
              <Link
                href="/p2p"
                className="text-xs font-semibold text-[#D4AF37] transition hover:text-[#F5E6B3] hover:underline"
              >
                Browse marketplace →
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/[0.06] bg-black/35 p-6">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#F5E6B3]">Recent reviews</h2>
        <div className="mt-4">
          <MerchantReviewList reviews={reviews} />
        </div>
      </section>
    </div>
  );
}
