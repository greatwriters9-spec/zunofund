"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { CryptoIcon } from "@/components/market-pickers/CryptoIcon";
import type { CryptoAssetItem } from "@/components/market-pickers/cryptoCatalog";
import {
  DEPOSIT_EXCHANGE_ASSETS,
  findDepositExchangeAsset,
} from "@/lib/depositExchangeAssets";

type DepositInlineCoinSelectorProps = {
  value: string;
  onChange: (code: string) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  assets?: CryptoAssetItem[];
};

export function DepositInlineCoinSelector({
  value,
  onChange,
  expanded,
  onExpandedChange,
  assets = DEPOSIT_EXCHANGE_ASSETS,
}: DepositInlineCoinSelectorProps) {
  const [search, setSearch] = useState("");
  const selectedAsset = findDepositExchangeAsset(value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(
      (item) =>
        item.symbol.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q),
    );
  }, [assets, search]);

  function handleSelect(code: string) {
    onChange(code);
    setSearch("");
    onExpandedChange(false);
  }

  if (!expanded && selectedAsset) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <CryptoIcon asset={selectedAsset} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100">{selectedAsset.symbol}</p>
            <p className="truncate text-[11px] text-zinc-500">{selectedAsset.name}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onExpandedChange(true)}
          className="shrink-0 text-xs font-medium text-[#D4AF37] transition hover:text-[#E5BD45]"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60">
      <div className="relative border-b border-zinc-800/80 px-3 py-2">
        <Search
          className="pointer-events-none absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Coin"
          className="h-9 w-full rounded-md border border-zinc-800 bg-transparent py-0 pl-8 pr-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-[#D4AF37]/40"
        />
      </div>

      <ul
        className="max-h-[220px] overflow-y-auto overscroll-contain"
        role="listbox"
        aria-label="Select coin"
      >
        {filtered.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-zinc-500">No coins found</li>
        ) : (
          filtered.map((asset) => {
            const active = asset.code === value;
            return (
              <li key={asset.code} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => handleSelect(asset.code)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition ${
                    active ? "bg-zinc-800/90" : "hover:bg-zinc-800/50"
                  }`}
                >
                  <CryptoIcon asset={asset} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-zinc-100">{asset.symbol}</span>
                    <span className="block truncate text-[11px] text-zinc-500">{asset.name}</span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
