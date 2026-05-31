import type { Metadata } from "next";

import { MarketDetailView } from "@/components/markets/MarketDetailView";
import { DEFAULT_MARKET_SYMBOLS, slugToSymbol, symbolToSlug } from "@/lib/markets/symbols";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return DEFAULT_MARKET_SYMBOLS.map((symbol) => ({
    slug: symbolToSlug(symbol),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const symbol = slugToSymbol(slug);
  const label = symbol?.replace("USDT", "") ?? slug.toUpperCase();
  return {
    title: `${label} / USDT`,
    description: `Live ${label} market data and chart on Zuno.`,
  };
};

export default async function MarketDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const symbol = slugToSymbol(slug);

  if (!symbol) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05080F] text-zinc-400">
        Invalid market pair.
      </div>
    );
  }

  return <MarketDetailView symbol={symbol} />;
}
