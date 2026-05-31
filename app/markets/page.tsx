import type { Metadata } from "next";

import { MarketsView } from "@/components/markets/MarketsView";

export const metadata: Metadata = {
  title: "Markets",
  description: "Live cryptocurrency market data powered by Binance.",
};

export default function MarketsPage() {
  return <MarketsView />;
}
