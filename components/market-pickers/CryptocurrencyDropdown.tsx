"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

import { CryptoIcon } from "@/components/market-pickers/CryptoIcon";
import {
  canSelectCrypto,
  filterCryptoAssets,
  showCryptoComingSoon,
  type CryptoAssetItem,
} from "@/components/market-pickers/cryptoCatalog";

export type CryptocurrencyDropdownProps = {
  open: boolean;
  selectedCode: string;
  onClose: () => void;
  onSelect: (code: string) => void;
  context: "landing" | "portal";
  assetList?: CryptoAssetItem[];
  forceSelectable?: boolean;
  allowAllCrypto?: boolean;
};

export function CryptocurrencyDropdown({
  open,
  selectedCode,
  onClose,
  onSelect,
  context,
  assetList,
  forceSelectable = false,
  allowAllCrypto = false,
}: CryptocurrencyDropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    if (assetList) {
      const q = search.trim().toLowerCase();
      if (!q) return assetList;
      return assetList.filter(
        (item) =>
          item.symbol.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q),
      );
    }
    return filterCryptoAssets(search, context);
  }, [search, context, assetList]);

  const allCrypto = allowAllCrypto ? filtered.find((c) => c.code === "ALL") : undefined;
  const listItems = filtered.filter((c) => c.code !== "ALL");

  if (!open) return null;

  function pickAsset(asset: CryptoAssetItem) {
    if (!forceSelectable && !canSelectCrypto(asset, context)) return;
    onSelect(asset.code);
    onClose();
  }

  return (
    <div
      ref={rootRef}
      role="listbox"
      aria-label="Cryptocurrency"
      className="absolute left-0 top-[calc(100%+6px)] z-[120] flex w-[min(18rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-white/[0.1] bg-[#0c1018] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.85)] backdrop-blur-md"
    >
      <div className="relative shrink-0 border-b border-white/[0.06] p-2">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          autoFocus
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/80 py-2 pl-9 pr-3 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-[#D4AF37]/45"
        />
      </div>

      <ul className="max-h-[min(320px,50dvh)] overflow-y-auto overscroll-contain py-1.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5">
        {allCrypto ? (
          <li>
            <button
              type="button"
              onClick={() => pickAsset(allCrypto)}
              disabled={context === "portal" && !allCrypto.liveOnPlatform}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition hover:bg-white/[0.05] ${
                selectedCode === "ALL" ? "bg-[#D4AF37]/10 text-[#F5E6B3]" : "text-zinc-300"
              }`}
            >
              <CryptoIcon asset={allCrypto} />
              <span className="font-semibold">All crypto</span>
            </button>
          </li>
        ) : null}

        {listItems.map((asset) => {
          const disabled = !forceSelectable && !canSelectCrypto(asset, context);
          const comingSoon = !forceSelectable && showCryptoComingSoon(asset, context);
          const active = selectedCode === asset.code;

          return (
            <li key={asset.code}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => pickAsset(asset)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${
                  disabled
                    ? "cursor-not-allowed opacity-50"
                    : active
                      ? "bg-[#D4AF37]/10 text-[#F5E6B3]"
                      : "text-zinc-300 hover:bg-white/[0.05]"
                }`}
              >
                <CryptoIcon asset={asset} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">{asset.symbol}</span>
                  {comingSoon ? (
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                      Coming soon
                    </span>
                  ) : (
                    <span className="block truncate text-[11px] text-zinc-500">{asset.name}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}

        {filtered.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-zinc-500">No match</li>
        ) : null}
      </ul>
    </div>
  );
}
