import { formatMoneyAmount } from "@/lib/formatMoney";

export function formatMarketPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "—";
  if (price >= 1000) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (price >= 1) {
    return formatMoneyAmount(price);
  }
  if (price >= 0.0001) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    });
  }
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 6,
    maximumFractionDigits: 8,
  });
}

export function formatChangePercent(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function changeColorClass(pct: number): string {
  if (!Number.isFinite(pct) || pct === 0) return "text-zinc-400";
  return pct > 0 ? "text-emerald-400" : "text-red-400";
}

export function formatCompactVolume(vol: number): string {
  if (!Number.isFinite(vol) || vol <= 0) return "—";
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(2)}M`;
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(2)}K`;
  return vol.toFixed(2);
}
