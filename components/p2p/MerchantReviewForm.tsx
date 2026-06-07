"use client";

import { useCallback, useEffect, useState } from "react";

import type { MerchantReviewSentiment } from "@/lib/merchantReputation";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

type MerchantReviewFormProps = {
  orderId: string;
  onSubmitted?: () => void;
};

const SENTIMENTS: { value: MerchantReviewSentiment; label: string; emoji: string }[] = [
  { value: "positive", label: "Positive", emoji: "👍" },
  { value: "neutral", label: "Neutral", emoji: "😐" },
  { value: "negative", label: "Negative", emoji: "👎" },
];

export function MerchantReviewForm({ orderId, onSubmitted }: MerchantReviewFormProps) {
  const supabase = useSupabase();
  const [loading, setLoading] = useState(true);
  const [canReview, setCanReview] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [sentiment, setSentiment] = useState<MerchantReviewSentiment>("positive");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase.rpc("investor_get_order_review_status", {
      p_order_id: orderId,
    });
    setLoading(false);
    if (e) {
      setError(formatSupabaseError(e));
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;
    setCanReview(Boolean(row.can_review));
    setAlreadyReviewed(Boolean(row.already_reviewed));
    if (row.existing_sentiment) setSentiment(row.existing_sentiment as MerchantReviewSentiment);
    if (row.existing_comment) setComment(row.existing_comment);
  }, [orderId, supabase]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("investor_submit_merchant_review", {
      p_order_id: orderId,
      p_sentiment: sentiment,
      p_comment: comment.trim() || null,
    });
    setBusy(false);
    if (e) {
      setError(formatSupabaseError(e));
      return;
    }
    setOk(true);
    setAlreadyReviewed(true);
    onSubmitted?.();
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-[rgba(12,17,28,0.72)] px-4 py-3 text-sm text-[#8A93A5]">
        Checking feedback status…
      </div>
    );
  }

  if (!canReview) return null;

  if (alreadyReviewed || ok) {
    return (
      <div className="rounded-xl border border-[#00C076]/25 bg-[#00C076]/[0.08] px-4 py-3 text-sm text-emerald-100">
        Thank you — your feedback has been recorded.
      </div>
    );
  }

  return (
    <form
      onSubmit={(ev) => void submit(ev)}
      className="rounded-xl border border-white/[0.06] bg-[rgba(12,17,28,0.72)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      <h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#F5E6B3]">
        Rate this merchant
      </h3>
      <p className="mt-1 text-xs text-zinc-500">Share your experience after this completed trade.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {SENTIMENTS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setSentiment(s.value)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              sentiment === s.value
                ? "border-[#D4AF37]/50 bg-[#D4AF37]/15 text-[#F5E6B3]"
                : "border-white/10 bg-black/30 text-zinc-400 hover:border-white/20"
            }`}
          >
            <span aria-hidden>{s.emoji}</span> {s.label}
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Comment (optional)
        </span>
        <textarea
          value={comment}
          onChange={(ev) => setComment(ev.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Fast payment and excellent communication."
          className="mt-2 w-full resize-none rounded-lg border border-white/12 bg-black/45 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#D4AF37]/40"
        />
      </label>

      {error ? (
        <p className="mt-3 text-xs text-red-300">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#F7E3A0] via-[#D4AF37] to-[#EAC54F] px-4 py-2.5 text-sm font-bold text-black shadow-[0_0_24px_rgba(212,175,55,0.2)] transition hover:brightness-105 disabled:opacity-50 sm:w-auto"
      >
        {busy ? "Submitting…" : "Submit feedback"}
      </button>
    </form>
  );
}
