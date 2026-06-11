"use client";

import type { ReactNode } from "react";

import { AccountStatusProvider } from "@/lib/accountStatus";

export function AccountStatusRoot({ children }: { children: ReactNode }) {
  return <AccountStatusProvider>{children}</AccountStatusProvider>;
}
