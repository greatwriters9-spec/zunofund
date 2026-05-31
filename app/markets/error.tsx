"use client";

import Link from "next/link";

export default function MarketsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#05080F] px-6 text-center text-white">
      <p className="text-lg font-semibold text-white">Could not load this market</p>
      <p className="max-w-sm text-sm text-zinc-500">
        Something went wrong while opening the pair. Try again or return to the markets list.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-yellow-400"
        >
          Try again
        </button>
        <Link
          href="/markets"
          className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-200 hover:border-yellow-500/40"
        >
          Back to markets
        </Link>
      </div>
    </div>
  );
}
