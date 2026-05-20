import { P2pMarketplaceView } from "@/components/p2p/P2pMarketplaceView";

export default function P2pBuyPage() {
  return <P2pMarketplaceView initialTab="buy" backHref="/deposit" backLabel="Deposit options" />;
}
