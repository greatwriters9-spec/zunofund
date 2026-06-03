import type { CryptoAssetItem } from "@/components/market-pickers/cryptoCatalog";

export function CryptoIcon({ asset, size = "md" }: { asset: CryptoAssetItem; size?: "md" | "lg" }) {
  const dim = size === "lg" ? "h-10 w-10 text-sm" : "h-9 w-9 text-xs";
  const letter = asset.code === "ALL" ? "◎" : asset.symbol.slice(0, 1);

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${dim}`}
      style={{ backgroundColor: asset.iconColor }}
      aria-hidden
    >
      {letter}
    </span>
  );
}
