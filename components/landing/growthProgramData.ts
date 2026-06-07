import { Crown, Gift, Percent, Shield, type LucideIcon } from "lucide-react";

export const ENROLLMENT_DEADLINE = new Date("2027-01-01T00:00:00");
export const FOUNDING_POSITIONS_REMAINING = 143;

export type GrowthProgramBenefit = {
  icon: LucideIcon;
  title: string;
  text: string;
};

export const GROWTH_PROGRAM_BENEFITS: GrowthProgramBenefit[] = [
  {
    icon: Crown,
    title: "Priority Marketplace Access",
    text: "Get early access to new features and trading opportunities.",
  },
  {
    icon: Percent,
    title: "Reduced Trading Fees",
    text: "Enjoy up to 50% lower fees as a founding investor.",
  },
  {
    icon: Gift,
    title: "Referral Rewards Boost",
    text: "Earn higher rewards on every successful referral.",
  },
  {
    icon: Shield,
    title: "Founding Investor Protection",
    text: "Enhanced security and priority support, always.",
  },
];
