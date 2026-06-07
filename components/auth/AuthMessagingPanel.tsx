"use client";

import { AuthFloatingCoins } from "@/components/auth/AuthFloatingCoins";

const INFO_BLOCKS = [
  {
    title: "Earn While You Hold",
    text: "Instead of letting your crypto sit in a wallet, participate in structured investment opportunities.",
  },
  {
    title: "Maintain Ownership",
    text: "Track and manage your investments while retaining full visibility of your assets.",
  },
  {
    title: "Built For Long-Term Investors",
    text: "Designed for people who believe in crypto and want more than simply holding coins.",
  },
] as const;

export function AuthMessagingPanel() {
  return (
    <div className="relative flex h-full flex-col justify-center px-12 py-16 xl:px-20">
      <AuthFloatingCoins />

      <div className="relative max-w-xl">
        <h2 className="text-[2.35rem] font-bold leading-[1.12] tracking-tight text-zinc-900 xl:text-[2.75rem]">
          Why hold crypto
          <br />
          when it can{" "}
          <span className="text-[#C9A227]">work for you?</span>
        </h2>

        <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-zinc-500">
          <p>Most investors buy crypto and wait.</p>
          <p>Your assets sit idle while opportunities pass by.</p>
          <p>
            Zuno helps you put your crypto to work through investment plans designed for long-term
            growth.
          </p>
        </div>

        <div className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {INFO_BLOCKS.map(({ title, text }) => (
            <div key={title}>
              <div className="mb-4 h-px w-10 bg-[#D4AF37]/70" />
              <h3 className="text-sm font-bold text-zinc-900">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
