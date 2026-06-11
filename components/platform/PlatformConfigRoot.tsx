"use client";

import type { ReactNode } from "react";

import { PlatformConfigProvider } from "@/lib/platformConfig";

export function PlatformConfigRoot({ children }: { children: ReactNode }) {
  return <PlatformConfigProvider>{children}</PlatformConfigProvider>;
}
