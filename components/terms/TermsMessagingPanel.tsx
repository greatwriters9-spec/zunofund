"use client";

import { AuthFloatingCoins } from "@/components/auth/AuthFloatingCoins";

const BENEFITS = [
  "Investor Protection",
  "Transparent Operations",
  "Secure Platform Access",
] as const;

export function TermsMessagingPanel() {
  return (
    <div className="relative flex h-full flex-col justify-center px-8 py-12 sm:px-12 lg:px-12 lg:py-16 xl:px-20">
      <AuthFloatingCoins />

      <div className="relative max-w-xl">
        <h2 className="text-[1.75rem] font-bold leading-[1.15] tracking-tight text-zinc-900 sm:text-[2.35rem] xl:text-[2.75rem]">
          Why Understanding The{" "}
          <span className="text-[#C9A227]">Rules Matters</span>
        </h2>

        <div className="mt-6 space-y-3 text-sm leading-relaxed text-zinc-500 sm:mt-8 sm:text-[15px]">
          <p>Investing requires informed decisions.</p>
          <p>
            Understanding the platform terms helps protect your assets, your account, and your
            investment journey.
          </p>
        </div>

        <ul className="mt-8 space-y-4 sm:mt-12">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/15 text-xs font-bold text-[#C9A227]"
                aria-hidden
              >
                ✓
              </span>
              <span className="text-sm font-semibold text-zinc-800">{benefit}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
