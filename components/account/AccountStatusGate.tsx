"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { AccountBannedScreen } from "@/components/account/AccountBannedScreen";
import { AccountOnHoldBanner } from "@/components/account/AccountOnHoldBanner";
import {
  accountStatusRedirectPath,
  isPathAllowedForAccountStatus,
} from "@/lib/accountStatus";
import { useAccountStatus } from "@/lib/accountStatus";
import { useAuthUser } from "@/hooks/useAuthUser";

const SKIP_PREFIXES = [
  "/auth",
  "/admin",
  "/admin-login",
  "/merchant",
  "/api/",
  "/account-suspended",
  "/account-banned",
];

function shouldEnforceAccountStatus(pathname: string): boolean {
  if (!pathname) return false;
  return !SKIP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function AccountStatusGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { userId, loading: authLoading } = useAuthUser();
  const { status, snapshot, loading: statusLoading } = useAccountStatus();

  useEffect(() => {
    if (authLoading || statusLoading || !userId) return;
    if (!shouldEnforceAccountStatus(pathname)) return;

    if (!isPathAllowedForAccountStatus(status, pathname)) {
      const target = accountStatusRedirectPath(status) ?? "/dashboard";
      if (pathname !== target) {
        router.replace(target);
      }
    }
  }, [authLoading, statusLoading, userId, status, pathname, router]);

  const enforcing = userId && shouldEnforceAccountStatus(pathname);
  const pathAllowed = isPathAllowedForAccountStatus(status, pathname);

  const showOnHoldBanner =
    enforcing && status === "on_hold" && pathAllowed;

  if (enforcing && (authLoading || statusLoading)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-400">
        Checking account status…
      </div>
    );
  }

  if (enforcing && status === "banned" && !pathAllowed) {
    return <AccountBannedScreen snapshot={snapshot} />;
  }

  if (enforcing && !pathAllowed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-400">
        Redirecting…
      </div>
    );
  }

  return (
    <>
      {showOnHoldBanner ? <AccountOnHoldBanner /> : null}
      {children}
    </>
  );
}
