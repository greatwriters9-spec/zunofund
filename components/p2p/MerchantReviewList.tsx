"use client";

import type { MerchantReviewRow } from "@/lib/merchantReputation";

type MerchantReviewListProps = {
  reviews: MerchantReviewRow[];
  emptyLabel?: string;
};

export function MerchantReviewList({
  reviews,
  emptyLabel = "No reviews yet.",
}: MerchantReviewListProps) {
  if (reviews.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-4">
      {reviews.map((r) => (
        <li
          key={r.id}
          className="rounded-xl border border-white/[0.06] bg-black/35 px-4 py-3"
        >
          <p className="text-[15px] tracking-wide text-[#D4AF37]" aria-hidden>
            {sentimentStars(r.sentiment)}
          </p>
          {r.comment?.trim() ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{r.comment.trim()}</p>
          ) : (
            <p className="mt-2 text-sm italic text-zinc-500">No comment provided.</p>
          )}
          <p className="mt-2 text-xs text-zinc-500">— {r.reviewer_name || "Anonymous"}</p>
        </li>
      ))}
    </ul>
  );
}

function sentimentStars(sentiment: MerchantReviewRow["sentiment"]): string {
  const n = sentimentStarCount(sentiment);
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function sentimentStarCount(sentiment: MerchantReviewRow["sentiment"]): number {
  if (sentiment === "positive") return 5;
  if (sentiment === "negative") return 1;
  return 3;
}
