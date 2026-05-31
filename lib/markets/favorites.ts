const STORAGE_KEY = "zuno_market_favorites";

export function readMarketFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string").map((s) => s.toUpperCase());
  } catch {
    return [];
  }
}

export function writeMarketFavorites(symbols: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(symbols.map((s) => s.toUpperCase()))]));
  } catch {
    /* ignore quota */
  }
}

export function toggleMarketFavorite(symbol: string, current: string[]): string[] {
  const s = symbol.toUpperCase();
  const next = current.includes(s) ? current.filter((x) => x !== s) : [...current, s];
  writeMarketFavorites(next);
  return next;
}
