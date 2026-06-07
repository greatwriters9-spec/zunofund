"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";

import { CryptoIcon } from "@/components/market-pickers/CryptoIcon";
import {
  DEPOSIT_EXCHANGE_ASSETS,
  filterDepositExchangeAssets,
} from "@/lib/depositExchangeAssets";
import { useAuthUser } from "@/hooks/useAuthUser";
import { loginHref } from "@/lib/authLinks";
import { spotDepositPath } from "@/lib/spotDeposit";

export function MobileLandingSpotAssetList() {
  const router = useRouter();
  const { isAuthenticated } = useAuthUser();
  const [query, setQuery] = useState("");

  const assets = useMemo(() => filterDepositExchangeAssets(query), [query]);

  function handleAssetClick(code: string) {
    const destination = spotDepositPath(code);
    router.push(isAuthenticated ? destination : loginHref(destination));
  }

  return (
    <div className="mt-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search assets"
          aria-label="Search crypto assets"
          className="h-11 w-full rounded-xl border border-white/[0.1] bg-black/35 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-[#D4AF37]/45 focus:ring-2 focus:ring-[#D4AF37]/20"
        />
      </div>

      <div className="mt-2 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        {assets.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-zinc-500">No assets match your search.</p>
        ) : (
          assets.map((asset) => (
            <button
              key={asset.code}
              type="button"
              onClick={() => handleAssetClick(asset.code)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04] active:bg-white/[0.06]"
            >
              <CryptoIcon asset={asset} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{asset.symbol}</p>
                <p className="truncate text-xs text-zinc-500">{asset.name}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
            </button>
          ))
        )}
      </div>

      {!query ? (
        <p className="mt-3 text-center text-[10px] text-zinc-500">
          {DEPOSIT_EXCHANGE_ASSETS.length} assets available for spot deposits
        </p>
      ) : null}
    </div>
  );
}
