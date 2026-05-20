import { P2pMarketplaceView } from "@/components/p2p/P2pMarketplaceView";

/** P2P marketplace: Paxful-style listing with Buy / Sell tabs (same RPCs as /p2p/buy and /p2p/sell). */
export default function P2pMarketplaceHubPage() {
  return <P2pMarketplaceView initialTab="buy" backHref="/dashboard" backLabel="Dashboard" />;
}
