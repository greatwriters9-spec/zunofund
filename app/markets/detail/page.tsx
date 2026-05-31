"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { MarketDetailView } from "@/components/markets/MarketDetailView";
import { slugToSymbol } from "@/lib/markets/symbols";

function MarketDetailContent() {
  const searchParams = useSearchParams();
  const slug = (searchParams.get("slug") ?? "").trim();
  const symbol = slug ? slugToSymbol(slug) : null;

  if (!symbol) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#05080F] px-6 text-center text-zinc-400">
        <p>Invalid market pair.</p>
        <Link href="/markets" className="text-sm font-semibold text-yellow-500 hover:text-yellow-400">
          Back to markets
        </Link>
      </div>
    );
  }

  return <MarketDetailView symbol={symbol} />;
}

function MarketDetailFallback() {
  return (
    <div className="min-h-screen bg-[#05080F] px-4 py-8">
      <div className="mx-auto max-w-4xl animate-pulse space-y-4">
        <div className="h-6 w-24 rounded bg-zinc-800/80" />
        <div className="h-10 w-48 rounded bg-zinc-800/80" />
        <div className="h-[320px] rounded-xl bg-zinc-900/40" />
      </div>
    </div>
  );
}

export default function MarketDetailPage() {
  return (
    <Suspense fallback={<MarketDetailFallback />}>
      <MarketDetailContent />
    </Suspense>
  );
}
