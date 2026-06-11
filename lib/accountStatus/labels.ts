import type { AccountStatus } from "@/lib/accountStatus/types";

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  active: "Active",
  on_hold: "On Hold",
  suspended: "Suspended",
  banned: "Banned",
};

export const ACCOUNT_STATUS_BADGE_CLASS: Record<AccountStatus, string> = {
  active: "border-green-500/40 bg-green-500/15 text-green-300",
  on_hold: "border-yellow-500/40 bg-yellow-500/15 text-yellow-200",
  suspended: "border-orange-500/40 bg-orange-500/15 text-orange-200",
  banned: "border-red-500/40 bg-red-500/15 text-red-300",
};

export function normalizeAccountStatus(raw: string | null | undefined): AccountStatus {
  const s = (raw ?? "").toLowerCase().trim();
  if (s === "active" || s === "on_hold" || s === "suspended" || s === "banned") {
    return s;
  }
  return "active";
}
