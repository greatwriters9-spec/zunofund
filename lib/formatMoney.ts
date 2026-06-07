export function toMoneyNumber(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const MONEY_FORMAT: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
};

/** USD/USDT amounts: at least 2 decimal places, at most 4. */
export function formatMoneyAmount(
  value: number | string | null | undefined,
): string {
  return toMoneyNumber(value).toLocaleString("en-US", MONEY_FORMAT);
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
  return toMoneyNumber(value).toLocaleString("en-US", MONEY_FORMAT);
}

export function formatUsdLocale(
  value: number | string | null | undefined,
): string {
  return `$${formatMoneyLocale(value)}`;
}

function formatUsdInText(value: number): string {
  return `$${toMoneyNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Normalize legacy notification/email copy like `$50.00000000` → `$50.00`. */
export function formatUsdAmountsInText(text: string): string {
  return text.replace(
    /\$[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)+|\$[0-9]+(?:\.[0-9]+)*/g,
    (match) => {
      const raw = match.slice(1).replace(/,/g, "");
      const parts = raw.split(".");
      const intPart = parts[0] ?? "0";
      const fracPart = parts.slice(1).join("");
      const n = Number(fracPart ? `${intPart}.${fracPart}` : intPart);
      if (!Number.isFinite(n)) return match;
      return formatUsdInText(n);
    },
  );
}
