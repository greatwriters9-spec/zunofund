"use client";

import { useEffect, useState } from "react";

function resolveRecaptchaBranchActive(variant: "default" | "mobile"): boolean {
  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
  return variant === "mobile" ? !isDesktop : isDesktop;
}

/** Only mount reCAPTCHA in the visible auth form branch (mobile vs desktop). */
export function useRecaptchaActiveBranch(variant: "default" | "mobile" = "default"): boolean {
  // Start false so SSR and the first client paint match; sync after mount.
  const [active, setActive] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");

    const sync = () => {
      setActive(resolveRecaptchaBranchActive(variant));
    };

    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [variant]);

  return active;
}
