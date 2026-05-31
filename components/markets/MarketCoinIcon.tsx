"use client";

import { useState } from "react";

import { coinIconUrl } from "@/lib/markets/symbols";

type MarketCoinIconProps = {
  baseAsset: string;
  size?: number;
};

export function MarketCoinIcon({ baseAsset, size = 36 }: MarketCoinIconProps) {
  const [failed, setFailed] = useState(false);
  const letter = baseAsset.slice(0, 1).toUpperCase();

  if (failed) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full border border-yellow-500/25 bg-yellow-500/10 font-bold text-yellow-500/90"
        style={{ width: size, height: size, fontSize: size * 0.38 }}
        aria-hidden
      >
        {letter}
      </div>
    );
  }

  return (
    <img
      src={coinIconUrl(baseAsset)}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-zinc-900"
      onError={() => setFailed(true)}
    />
  );
}
