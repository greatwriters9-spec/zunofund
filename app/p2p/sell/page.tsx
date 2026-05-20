import { P2pMarketplaceView } from "@/components/p2p/P2pMarketplaceView";

export default function P2pSellPage() {
  return <P2pMarketplaceView initialTab="sell" backHref="/withdraw" backLabel="Withdraw options" />;
}
