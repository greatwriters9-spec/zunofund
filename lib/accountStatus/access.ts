import type { AccountStatus } from "@/lib/accountStatus/types";

export type AccountAction =
  | "deposit"
  | "withdraw"
  | "invest"
  | "p2p"
  | "transfer"
  | "order"
  | "profit_accrue";

const ON_HOLD_BLOCKED: AccountAction[] = [
  "deposit",
  "withdraw",
  "invest",
  "p2p",
  "transfer",
  "order",
];

const RESTRICTED_BLOCKED: AccountAction[] = [
  ...ON_HOLD_BLOCKED,
  "profit_accrue",
];

/** Paths always reachable regardless of status (when authenticated). */
export const ACCOUNT_STATUS_ALWAYS_ALLOWED = [
  "/support",
  "/contact",
] as const;

/** Paths allowed when account is suspended. */
export const SUSPENDED_ALLOWED_PATHS = [
  "/account-suspended",
  "/dashboard/profile",
  ...ACCOUNT_STATUS_ALWAYS_ALLOWED,
] as const;

/** Paths allowed when account is banned. */
export const BANNED_ALLOWED_PATHS = [
  "/account-banned",
  ...ACCOUNT_STATUS_ALWAYS_ALLOWED,
] as const;

/** Paths blocked when account is on hold (financial / trading). */
export const ON_HOLD_BLOCKED_PATH_PREFIXES = [
  "/deposit",
  "/withdraw",
  "/p2p",
  "/spot/deposit",
] as const;

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function canPerformAccountAction(
  status: AccountStatus,
  action: AccountAction,
): boolean {
  if (status === "active") return true;
  if (status === "on_hold") return !ON_HOLD_BLOCKED.includes(action);
  return !RESTRICTED_BLOCKED.includes(action);
}

export function isPathAllowedForAccountStatus(
  status: AccountStatus,
  pathname: string,
): boolean {
  const path = pathname.split("?")[0] ?? pathname;

  if (status === "active") return true;

  if (status === "banned") {
    return BANNED_ALLOWED_PATHS.some((p) => pathMatchesPrefix(path, p));
  }

  if (status === "suspended") {
    return SUSPENDED_ALLOWED_PATHS.some((p) => pathMatchesPrefix(path, p));
  }

  if (status === "on_hold") {
    if (pathMatchesPrefix(path, "/p2p/order")) {
      return true;
    }
    return !ON_HOLD_BLOCKED_PATH_PREFIXES.some((p) => pathMatchesPrefix(path, p));
  }

  return true;
}

export function accountStatusRedirectPath(status: AccountStatus): string | null {
  if (status === "banned") return "/account-banned";
  if (status === "suspended") return "/account-suspended";
  return null;
}
