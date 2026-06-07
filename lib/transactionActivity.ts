import {
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  LineChart,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type TransactionActivityType =
  | "deposit"
  | "withdrawal"
  | "profit"
  | "referral_bonus"
  | "reward"
  | string;

type ActivityMeta = {
  label: string;
  icon: LucideIcon;
  tone: string;
};

export function transactionActivityMeta(type: TransactionActivityType): ActivityMeta {
  switch (type) {
    case "deposit":
      return {
        label: "Deposit",
        icon: ArrowDownLeft,
        tone: "text-[#00C076] bg-[#00C076]/10",
      };
    case "withdrawal":
      return {
        label: "Withdrawal",
        icon: ArrowUpRight,
        tone: "text-red-400 bg-red-500/10",
      };
    case "profit":
      return {
        label: "ROI Payment",
        icon: TrendingUp,
        tone: "text-[#D4AF37] bg-[#D4AF37]/10",
      };
    case "referral_bonus":
      return {
        label: "Referral bonus",
        icon: Gift,
        tone: "text-[#D4AF37] bg-[#D4AF37]/10",
      };
    case "reward":
      return {
        label: "Reward",
        icon: Gift,
        tone: "text-[#F5E6B3] bg-[#D4AF37]/10",
      };
    default:
      return {
        label: type.replace(/_/g, " "),
        icon: LineChart,
        tone: "text-zinc-300 bg-white/[0.06]",
      };
  }
}

export function transactionStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved" || s === "completed" || s === "credited") return "text-[#00C076]";
  if (s === "rejected" || s === "failed" || s === "cancelled") return "text-red-400";
  return "text-[#D4AF37]";
}

export function formatTransactionStatus(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved") return "Completed";
  if (s === "pending") return "Pending";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatTransactionDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
