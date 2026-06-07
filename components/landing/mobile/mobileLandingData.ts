export const MOBILE_MARKETPLACE_SECTION_ID = "mobile-marketplace";

export const MOBILE_LANDING_TABS = [
  { id: "p2p", label: "P2P", targetId: MOBILE_MARKETPLACE_SECTION_ID },
  { id: "spot", label: "Spot", targetId: MOBILE_MARKETPLACE_SECTION_ID },
  { id: "invest", label: "Invest", targetId: "mobile-invest" },
] as const;

export type MobileLandingTabId = (typeof MOBILE_LANDING_TABS)[number]["id"];

export const MOBILE_CRYPTO_ASSETS = [
  { symbol: "BTC", color: "#F7931A" },
  { symbol: "ETH", color: "#627EEA" },
  { symbol: "USDT", color: "#26A17B" },
  { symbol: "LTC", color: "#B8C2CC" },
] as const;
