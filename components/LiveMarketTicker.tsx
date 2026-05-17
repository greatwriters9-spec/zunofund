"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ExternalLink, TrendingDown, TrendingUp } from "lucide-react";

const COIN_IDS = ["bitcoin", "ethereum", "tether", "ripple"] as const;
type CoinId = (typeof COIN_IDS)[number];

interface CoinDisplay {
  id: CoinId;
  symbol: string;
  name: string;
  badgeBg: string;
  badgeFg: string;
}

const COINS: CoinDisplay[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", badgeBg: "#F7931A", badgeFg: "#fff" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", badgeBg: "#627EEA", badgeFg: "#fff" },
  { id: "tether", symbol: "USDT", name: "Tether", badgeBg: "#26A17B", badgeFg: "#fff" },
  { id: "ripple", symbol: "XRP", name: "XRP", badgeBg: "#23292F", badgeFg: "#fff" },
];

interface PriceState {
  usd: number;
  change24h: number;
}

export interface LiveMarketPricesState {
  prices: Record<CoinId, PriceState> | null;
  error: string | null;
  updatedAt: Date | null;
}

const REFRESH_INTERVAL_MS = 60_000;

function formatPrice(value: number): string {
  if (value >= 1000) {
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  }
  if (value >= 1) {
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
  }
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function formatChange(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function useLiveMarketPrices(): LiveMarketPricesState {
  const [prices, setPrices] = useState<Record<CoinId, PriceState> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function fetchPrices() {
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${COIN_IDS.join(
            ",",
          )}&vs_currencies=usd&include_24hr_change=true`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = (await res.json()) as Record<
          CoinId,
          { usd: number; usd_24h_change?: number }
        >;
        if (cancelled) return;

        const next = {} as Record<CoinId, PriceState>;
        for (const coin of COIN_IDS) {
          const row = data[coin];
          if (row && typeof row.usd === "number") {
            next[coin] = {
              usd: row.usd,
              change24h:
                typeof row.usd_24h_change === "number" ? row.usd_24h_change : 0,
            };
          }
        }
        setPrices(next);
        setUpdatedAt(new Date());
        setError(null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load prices");
      }
    }

    fetchPrices();
    const id = window.setInterval(fetchPrices, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(id);
    };
  }, []);

  return { prices, error, updatedAt };
}

export function LiveMarketTickerView({
  prices,
  error,
  updatedAt,
  embedded = false,
  stripe = false,
  headingId = "markets-heading",
  className,
}: LiveMarketPricesState & {
  embedded?: boolean;
  stripe?: boolean;
  headingId?: string;
  className?: string;
}) {
  const layout = stripe ? "stripe" : embedded ? "embedded" : "default";

  const layoutSectionClass =
    layout === "stripe"
      ? "relative -mx-6 mt-16 border-y border-white/10 bg-zinc-950/70 py-10 backdrop-blur-md lg:-mx-12 lg:mt-24 lg:py-14"
      : layout === "embedded"
        ? "relative py-8 lg:py-10"
        : "relative px-6 py-16 lg:px-12 lg:py-20";

  return (
    <section
      aria-labelledby={headingId}
      className={[layoutSectionClass, className].filter(Boolean).join(" ")}
    >
      <div
        className={
          layout === "stripe"
            ? "mx-auto w-full max-w-7xl px-6 lg:px-12"
            : layout === "embedded"
              ? "mx-auto w-full max-w-none"
              : "mx-auto max-w-7xl"
        }
      >
        <div
          className={
            layout === "embedded"
              ? "mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
              : "mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
          }
        >
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-3 py-1 text-xs font-medium text-[#D4AF37]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D4AF37] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#D4AF37]" />
              </span>
              Live markets
            </div>
            <h2
              id={headingId}
              className={
                layout === "embedded"
                  ? "text-xl font-bold tracking-tight sm:text-2xl"
                  : "text-2xl font-bold tracking-tight sm:text-3xl"
              }
            >
              Real-time pricing across major assets
            </h2>
            <p className="mt-2 text-sm text-gray-400 sm:text-base">
              {updatedAt
                ? `Last updated ${formatTimestamp(updatedAt)} · refreshes every minute`
                : "Streaming prices from public market data"}
            </p>
          </div>

          <a
            href="https://www.coingecko.com/en/markets"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 px-4 py-2.5 text-sm font-semibold text-[#D4AF37] transition hover:border-[#D4AF37] hover:bg-[#D4AF37]/15 sm:self-end"
          >
            View full markets
            <ExternalLink size={14} aria-hidden />
          </a>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/5 px-5 py-4 text-sm text-red-300"
          >
            Couldn&rsquo;t reach the live market feed ({error}). Retrying automatically.
          </div>
        ) : null}

        <div
          className={
            layout === "embedded"
              ? "grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4"
              : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          }
        >
          {COINS.map((coin) => {
            const data = prices?.[coin.id];
            const change = data?.change24h ?? 0;
            const isUp = change >= 0;
            return (
              <div
                key={coin.id}
                className="group relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-950/70 p-4 backdrop-blur-xl transition duration-300 hover:border-[#D4AF37]/40 sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tracking-tight"
                      style={{
                        background: coin.badgeBg,
                        color: coin.badgeFg,
                      }}
                      aria-hidden
                    >
                      {coin.symbol}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {coin.symbol}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {coin.name}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold tabular-nums ${
                      data
                        ? isUp
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                        : "bg-zinc-800/60 text-zinc-500"
                    }`}
                    aria-label={
                      data
                        ? `24 hour change ${formatChange(change)}`
                        : "Loading"
                    }
                  >
                    {data ? (
                      <>
                        {isUp ? (
                          <TrendingUp size={12} aria-hidden />
                        ) : (
                          <TrendingDown size={12} aria-hidden />
                        )}
                        {formatChange(change)}
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>

                <div className="mt-5 flex items-end justify-between gap-3">
                  <p className="text-2xl font-bold tabular-nums text-white sm:text-[28px]">
                    {data ? formatPrice(data.usd) : "—"}
                  </p>
                  <ArrowUpRight
                    size={18}
                    className="text-zinc-600 transition group-hover:text-[#D4AF37]"
                    aria-hidden
                  />
                </div>

                <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">
                  24h change
                </p>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Prices powered by CoinGecko. For informational purposes only — not
          investment advice.
        </p>
      </div>
    </section>
  );
}

/** Single instance with its own data subscription (most pages). */
export function LiveMarketTicker({
  embedded = false,
  stripe = false,
  headingId = "markets-heading",
  className,
}: {
  embedded?: boolean;
  stripe?: boolean;
  headingId?: string;
  className?: string;
}) {
  const state = useLiveMarketPrices();
  return (
    <LiveMarketTickerView
      {...state}
      embedded={embedded}
      stripe={stripe}
      headingId={headingId}
      className={className}
    />
  );
}
