"use client";

import { maxDailyRoiShortLabel } from "@/lib/platformConfig/helpers";
import { usePlatformConfig } from "@/lib/platformConfig";

export function AuthMobileHero() {
  const { config } = usePlatformConfig();

  return (
    <div className="mb-6 text-center">
      <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-black">
        Earn Up To <span className="text-[#C9A227]">{maxDailyRoiShortLabel(config.plans)}</span>
      </h1>
      <p className="mt-2.5 text-[15px] text-zinc-600">Put your crypto to work with Zuno.</p>
    </div>
  );
}
