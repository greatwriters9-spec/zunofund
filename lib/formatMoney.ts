export function toMoneyNumber(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoneyAmount(
  value: number | string | null | undefined,
): string {
  return toMoneyNumber(value).toFixed(2);
}

export function formatUsdAmount(
  value: number | string | null | undefined,
): string {
  return `$${formatMoneyAmount(value)}`;
}

export function formatSignedUsdAmount(
  value: number | string | null | undefined,
): string {
  const n = toMoneyNumber(value);
  if (n === 0) return "$0.00";
  const sign = n < 0 ? "-" : "+";
  return `${sign}$${formatMoneyAmount(Math.abs(n))}`;
}

export function formatMoneyLocale(
  value: number | string | null | undefined,
): string {
  return toMoneyNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatUsdLocale(
  value: number | string | null | undefined,
): string {
  return `$${formatMoneyLocale(value)}`;
}
