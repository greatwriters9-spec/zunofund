"use client";

import { useCallback, useEffect, useState } from "react";

import { MERCHANT_BADGE_SLUGS, MERCHANT_BADGE_LABELS } from "@/lib/merchantBadges";
import { MERCHANT_COUNTRIES } from "@/lib/merchantCountries";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

type ReputationRow = {
  user_id: string;
  display_name: string | null;
  country: string | null;
  badge_slug: string | null;
  about_merchant: string | null;
  member_since: string | null;
  reputation_total_trades: number;
  positive_feedback: number;
  negative_feedback: number;
  neutral_feedback: number;
  positive_feedback_percent: number;
  rating: number;
  completion_rate: number;
  total_volume_traded: number;
  avg_release_time_minutes: number | null;
  avg_payment_time_minutes: number | null;
  profile_photo_url: string | null;
};

type AdminReviewRow = {
  id: string;
  order_id: string;
  sentiment: string;
  comment: string | null;
  created_at: string;
  reviewer_name: string | null;
  moderated_hidden: boolean;
};

type AdminMerchantReputationPanelProps = {
  merchantUserId: string;
  onSaved?: () => void;
};

export function AdminMerchantReputationPanel({
  merchantUserId,
  onSaved,
}: AdminMerchantReputationPanelProps) {
  const supabase = useSupabase();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [form, setForm] = useState<ReputationRow | null>(null);
  const [reviews, setReviews] = useState<AdminReviewRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [repRes, revRes] = await Promise.all([
      supabase.rpc("admin_get_merchant_reputation", { p_user_id: merchantUserId }),
      supabase.rpc("admin_list_merchant_reviews", { p_merchant_user_id: merchantUserId }),
    ]);
    setLoading(false);
    if (repRes.error) {
      setError(formatSupabaseError(repRes.error));
      return;
    }
    const row = (Array.isArray(repRes.data) ? repRes.data[0] : repRes.data) as ReputationRow | undefined;
    setForm(row ?? null);
    setReviews((revRes.data as AdminReviewRow[]) ?? []);
  }, [merchantUserId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  function setField<K extends keyof ReputationRow>(key: K, value: ReputationRow[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    setOk(null);
    const { error: e } = await supabase.rpc("admin_update_merchant_reputation", {
      p_user_id: merchantUserId,
      p_country: form.country,
      p_badge_slug: form.badge_slug,
      p_about_merchant: form.about_merchant,
      p_member_since: form.member_since,
      p_reputation_total_trades: form.reputation_total_trades,
      p_positive_feedback: form.positive_feedback,
      p_negative_feedback: form.negative_feedback,
      p_neutral_feedback: form.neutral_feedback,
      p_positive_feedback_percent: form.positive_feedback_percent,
      p_rating: form.rating,
      p_completion_rate: form.completion_rate,
      p_total_volume_traded: form.total_volume_traded,
      p_avg_release_time_minutes: form.avg_release_time_minutes,
      p_avg_payment_time_minutes: form.avg_payment_time_minutes,
      p_profile_photo_url: form.profile_photo_url,
    });
    setBusy(false);
    if (e) {
      setError(formatSupabaseError(e));
      return;
    }
    setOk("Reputation settings saved.");
    onSaved?.();
  }

  async function toggleReviewHidden(reviewId: string, hidden: boolean) {
    setError(null);
    const { error: e } = await supabase.rpc("admin_moderate_merchant_review", {
      p_review_id: reviewId,
      p_hidden: hidden,
    });
    if (e) {
      setError(formatSupabaseError(e));
      return;
    }
    await load();
  }

  if (loading) {
    return <p className="text-xs text-zinc-500">Loading reputation settings…</p>;
  }

  if (!form) {
    return <p className="text-xs text-red-300">Could not load merchant reputation.</p>;
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-white/12 bg-black/45 px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]/40";
  const labelCls = "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";

  return (
    <div className="space-y-4 border-t border-white/10 pt-4">
      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[#F5E6B3]">
        Merchant reputation settings
      </h3>

      <form onSubmit={(ev) => void save(ev)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label>
          <span className={labelCls}>Country (admin only)</span>
          <select
            value={form.country ?? ""}
            onChange={(ev) => setField("country", ev.target.value || null)}
            className={inputCls}
          >
            <option value="">— Not set —</option>
            {MERCHANT_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className={labelCls}>Badge</span>
          <select
            value={form.badge_slug ?? ""}
            onChange={(ev) => setField("badge_slug", ev.target.value || null)}
            className={inputCls}
          >
            <option value="">— None —</option>
            {MERCHANT_BADGE_SLUGS.map((slug) => (
              <option key={slug} value={slug}>
                {MERCHANT_BADGE_LABELS[slug]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className={labelCls}>Rating (0–5)</span>
          <input
            type="number"
            step="0.1"
            min={0}
            max={5}
            value={form.rating}
            onChange={(ev) => setField("rating", Number(ev.target.value))}
            className={inputCls}
          />
        </label>

        <label>
          <span className={labelCls}>Total trades</span>
          <input
            type="number"
            min={0}
            value={form.reputation_total_trades}
            onChange={(ev) => setField("reputation_total_trades", Number(ev.target.value))}
            className={inputCls}
          />
        </label>

        <label>
          <span className={labelCls}>Positive feedback %</span>
          <input
            type="number"
            step="0.1"
            min={0}
            max={100}
            value={form.positive_feedback_percent}
            onChange={(ev) => setField("positive_feedback_percent", Number(ev.target.value))}
            className={inputCls}
          />
        </label>

        <label>
          <span className={labelCls}>Completion rate %</span>
          <input
            type="number"
            step="0.1"
            min={0}
            max={100}
            value={form.completion_rate}
            onChange={(ev) => setField("completion_rate", Number(ev.target.value))}
            className={inputCls}
          />
        </label>

        <label>
          <span className={labelCls}>Positive count</span>
          <input
            type="number"
            min={0}
            value={form.positive_feedback}
            onChange={(ev) => setField("positive_feedback", Number(ev.target.value))}
            className={inputCls}
          />
        </label>

        <label>
          <span className={labelCls}>Negative count</span>
          <input
            type="number"
            min={0}
            value={form.negative_feedback}
            onChange={(ev) => setField("negative_feedback", Number(ev.target.value))}
            className={inputCls}
          />
        </label>

        <label>
          <span className={labelCls}>Neutral count</span>
          <input
            type="number"
            min={0}
            value={form.neutral_feedback}
            onChange={(ev) => setField("neutral_feedback", Number(ev.target.value))}
            className={inputCls}
          />
        </label>

        <label>
          <span className={labelCls}>Volume traded (USD)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.total_volume_traded}
            onChange={(ev) => setField("total_volume_traded", Number(ev.target.value))}
            className={inputCls}
          />
        </label>

        <label>
          <span className={labelCls}>Avg release (minutes)</span>
          <input
            type="number"
            min={0}
            value={form.avg_release_time_minutes ?? ""}
            onChange={(ev) =>
              setField(
                "avg_release_time_minutes",
                ev.target.value === "" ? null : Number(ev.target.value),
              )
            }
            className={inputCls}
          />
        </label>

        <label>
          <span className={labelCls}>Avg payment (minutes)</span>
          <input
            type="number"
            min={0}
            value={form.avg_payment_time_minutes ?? ""}
            onChange={(ev) =>
              setField(
                "avg_payment_time_minutes",
                ev.target.value === "" ? null : Number(ev.target.value),
              )
            }
            className={inputCls}
          />
        </label>

        <label>
          <span className={labelCls}>Member since</span>
          <input
            type="date"
            value={form.member_since ? form.member_since.slice(0, 10) : ""}
            onChange={(ev) =>
              setField("member_since", ev.target.value ? `${ev.target.value}T00:00:00.000Z` : null)
            }
            className={inputCls}
          />
        </label>

        <label className="sm:col-span-2 lg:col-span-3">
          <span className={labelCls}>Profile photo URL (optional)</span>
          <input
            type="url"
            value={form.profile_photo_url ?? ""}
            onChange={(ev) => setField("profile_photo_url", ev.target.value || null)}
            placeholder="https://…"
            className={inputCls}
          />
        </label>

        <label className="sm:col-span-2 lg:col-span-3">
          <span className={labelCls}>Merchant description</span>
          <textarea
            rows={3}
            value={form.about_merchant ?? ""}
            onChange={(ev) => setField("about_merchant", ev.target.value || null)}
            className={inputCls}
          />
        </label>

        {error ? <p className="text-xs text-red-300 sm:col-span-2 lg:col-span-3">{error}</p> : null}
        {ok ? <p className="text-xs text-emerald-300 sm:col-span-2 lg:col-span-3">{ok}</p> : null}

        <div className="sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[#D4AF37] px-4 py-2 text-xs font-bold uppercase tracking-wide text-black hover:bg-[#E8C547] disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save reputation"}
          </button>
        </div>
      </form>

      {reviews.length > 0 ? (
        <div className="mt-4">
          <h4 className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Moderate reviews</h4>
          <ul className="mt-2 space-y-2">
            {reviews.map((r) => (
              <li
                key={r.id}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  r.moderated_hidden ? "border-red-500/30 bg-red-500/5 opacity-60" : "border-white/10 bg-black/30"
                }`}
              >
                <p className="font-semibold capitalize text-zinc-300">
                  {r.sentiment} · {r.reviewer_name ?? "Anonymous"}
                </p>
                {r.comment ? <p className="mt-1 text-zinc-500">{r.comment}</p> : null}
                <button
                  type="button"
                  onClick={() => void toggleReviewHidden(r.id, !r.moderated_hidden)}
                  className="mt-2 text-[10px] font-semibold uppercase text-[#D4AF37] hover:underline"
                >
                  {r.moderated_hidden ? "Show on profile" : "Hide from profile"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
