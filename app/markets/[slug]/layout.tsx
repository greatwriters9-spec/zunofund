import type { Metadata } from "next";
import type { ReactNode } from "react";

import { slugToSymbol } from "@/lib/markets/symbols";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const symbol = slugToSymbol(slug);
  const label = symbol?.replace("USDT", "") ?? slug.toUpperCase();
  return {
    title: `${label} / USDT`,
    description: `Live ${label} market data and chart on Zuno.`,
  };
}

export default function MarketDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
