export const MOBILE_LANDING_TABS = [
  { id: "p2p", label: "P2P", targetId: "mobile-p2p" },
  { id: "rewards", label: "Rewards", targetId: "mobile-rewards" },
  { id: "invest", label: "Invest", targetId: "mobile-invest" },
] as const;

export type MobileLandingTabId = (typeof MOBILE_LANDING_TABS)[number]["id"];

export const MOBILE_TRUST_ITEMS = [
  "Secure escrow on every trade",
  "Verified merchants worldwide",
  "350+ payment methods",
  "24/7 platform support",
] as const;
