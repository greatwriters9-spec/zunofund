"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { isMerchantPresencePath } from "@/lib/merchantPresence";

/** True while an active merchant has the console or P2P trade page open and the tab is visible. */
export function useMerchantPresenceLive(): boolean {
  const pathname = usePathname();
  const [tabVisible, setTabVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );

  useEffect(() => {
    const onVisibility = () => {
      setTabVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return isMerchantPresencePath(pathname) && tabVisible;
}
