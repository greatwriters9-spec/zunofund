"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { CryptoIcon } from "@/components/market-pickers/CryptoIcon";
import {
  canSelectCrypto,
  filterCryptoAssets,
  findCryptoLabel,
  showCryptoComingSoon,
  type CryptoAssetItem,
} from "@/components/market-pickers/cryptoCatalog";

export type CryptocurrencySheetProps = {
  open: boolean;
  selectedCode: string;
  onClose: () => void;
  onApply: (code: string, label: string) => void;
  context: "landing" | "portal";
  allowAllCrypto?: boolean;
  assetList?: CryptoAssetItem[];
  forceSelectable?: boolean;
  overlayClassName?: string;
  zIndexClass?: string;
};

export function CryptocurrencySheet({
  open,
  selectedCode,
  onClose,
  onApply,
  context,
  allowAllCrypto = false,
  assetList,
  forceSelectable = false,
  overlayClassName = "",
  zIndexClass = "z-[250]",
}: CryptocurrencySheetProps) {
  const [draftCode, setDraftCode] = useState(selectedCode);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setDraftCode(selectedCode);
      setSearch("");
    }
  }, [open, selectedCode]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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

  const allCrypto = allowAllCrypto
    ? filtered.find((c) => c.code === "ALL")
    : undefined;

  const listItems = filtered.filter((c) => c.code !== "ALL");

  const draftAsset = filtered.find((c) => c.code === draftCode);
  const canApply =
    Boolean(draftCode) &&
    Boolean(draftAsset) &&
    (forceSelectable || canSelectCrypto(draftAsset!, context));

  const isPortal = context === "portal";

  if (!open) return null;

  function handleApply() {
    if (!canApply || !draftCode) return;
    onApply(draftCode, findCryptoLabel(draftCode, context));
    onClose();
  }

  function selectAsset(asset: CryptoAssetItem) {
    if (!forceSelectable && !canSelectCrypto(asset, context)) return;
    setDraftCode(asset.code);
  }

  return (
    <div
      className={`fixed inset-0 flex flex-col bg-[#05080F] ${zIndexClass} ${overlayClassName}`}
      role="dialog"
      aria-modal="true"
      aria-label="Cryptocurrency"
    >
      <div className="shrink-0 border-b border-zinc-800/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <span className="w-10" aria-hidden />
          <h2 className="flex-1 text-center text-lg font-bold text-white">Cryptocurrency</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700/80 text-zinc-400 transition hover:border-[#D4AF37]/40 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="relative mt-4">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/80 py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-[#D4AF37]/45 focus:ring-1 focus:ring-[#D4AF37]/25"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-28 pt-4">
        {allCrypto ? (
          <button
            type="button"
            onClick={() => selectAsset(allCrypto)}
            disabled={isPortal && !allCrypto.liveOnPlatform}
            className={`mb-4 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition ${
              draftCode === "ALL"
                ? "bg-[linear-gradient(135deg,#F7E3A0_0%,#D4AF37_50%,#EAC54F_100%)] text-black shadow-[0_0_20px_rgba(212,175,55,0.25)]"
                : "bg-[#D4AF37]/15 text-[#F5E6B3] ring-1 ring-[#D4AF37]/30 hover:bg-[#D4AF37]/22"
            }`}
          >
            <CryptoIcon asset={allCrypto} size="lg" />
            <span className="text-sm font-bold">All crypto</span>
          </button>
        ) : null}

        <ul className="space-y-0.5">
          {listItems.map((asset) => (
            <CryptoRow
              key={asset.code}
              asset={asset}
              active={draftCode === asset.code}
              showComingSoon={!forceSelectable && showCryptoComingSoon(asset, context)}
              disabled={!forceSelectable && !canSelectCrypto(asset, context)}
              onSelect={() => selectAsset(asset)}
            />
          ))}
        </ul>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">No cryptocurrencies match your search.</p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-zinc-800/90 bg-[#05080F]/95 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <button
          type="button"
          disabled={!canApply}
          onClick={handleApply}
          className="w-full rounded-2xl bg-[linear-gradient(135deg,#F7E3A0_0%,#D4AF37_50%,#EAC54F_100%)] py-3.5 text-sm font-bold text-black shadow-[0_0_20px_rgba(212,175,55,0.28)] transition enabled:hover:bg-[#E5BD45] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

function CryptoRow({
  asset,
  active,
  showComingSoon,
  disabled,
  onSelect,
}: {
  asset: CryptoAssetItem;
  active: boolean;
  showComingSoon: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className={`flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition ${
          disabled
            ? "cursor-not-allowed opacity-55"
            : active
              ? "bg-[#D4AF37]/10 ring-1 ring-[#D4AF37]/30"
              : "hover:bg-white/[0.04]"
        }`}
      >
        <CryptoIcon asset={asset} />
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-bold ${disabled ? "text-zinc-500" : "text-white"}`}>
            {asset.symbol}
          </span>
          {showComingSoon ? (
            <span className="mt-0.5 inline-block rounded-md bg-zinc-800/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              Coming soon
            </span>
          ) : (
            <span className="mt-0.5 block text-xs text-zinc-500">{asset.name}</span>
          )}
        </span>
        {!disabled ? (
          <span
            className={`mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
              active ? "border-[#D4AF37] bg-[#D4AF37]" : "border-zinc-600"
            }`}
            aria-hidden
          >
            {active ? <span className="h-2 w-2 rounded-full bg-black" /> : null}
          </span>
        ) : null}
      </button>
    </li>
  );
}
