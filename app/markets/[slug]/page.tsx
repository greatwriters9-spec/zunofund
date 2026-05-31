"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { MarketDetailView } from "@/components/markets/MarketDetailView";
import { slugToSymbol } from "@/lib/markets/symbols";

export default function MarketDetailPage() {
  const params = useParams();
  const slug =
    typeof params.slug === "string"
      ? params.slug
      : Array.isArray(params.slug)
        ? (params.slug[0] ?? "")
        : "";

  const symbol = slugToSymbol(slug);

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
