"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

import { MarketCoinIcon } from "@/components/markets/MarketCoinIcon";
import { DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";
import { formatChangePercent, formatMarketPrice } from "@/lib/markets/format";
import { symbolToSlug } from "@/lib/markets/symbols";
import { useMarketTickers } from "@/lib/markets/useMarketTickers";

/** Platform-relevant majors — fixed order, horizontal strip on all breakpoints. */
const DASHBOARD_LIVE_MARKET_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "DOGEUSDT",
] as const;

function changeTone(pct: number): string {
  if (!Number.isFinite(pct) || pct === 0) return "text-[#8A93A5]";
  return pct > 0 ? "text-[#00C076]" : "text-red-400";
}

export function DashboardLiveMarketsStripe() {
  const symbols = useMemo(() => [...DASHBOARD_LIVE_MARKET_SYMBOLS], []);
  const { tickers, loading } = useMarketTickers(symbols);

  const ordered = useMemo(() => {
    const map = new Map(tickers.map((t) => [t.symbol, t]));
    return DASHBOARD_LIVE_MARKET_SYMBOLS.map((sym) => map.get(sym)).filter(Boolean);
  }, [tickers]);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45 }}
      aria-label="Live markets"
      className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 border-y border-white/[0.06] bg-[radial-gradient(ellipse_90%_80%_at_50%_50%,rgba(212,175,55,0.06)_0%,transparent_65%)] py-4 sm:py-5"
    >
      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00C076] opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00C076]" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-white">Live Markets</span>
          </div>
          <Link
            href="/markets"
            className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-[#D4AF37] transition hover:text-[#F5E6B3]"
          >
            View all
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <div className="mt-3 -mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
          {loading && ordered.length === 0 ? (
            <div className="flex min-w-max gap-3 lg:min-w-0 lg:grid lg:grid-cols-6 lg:gap-4">
              {DASHBOARD_LIVE_MARKET_SYMBOLS.map((sym) => (
                <div
                  key={sym}
                  className="h-[72px] w-[120px] shrink-0 animate-pulse rounded-xl bg-white/[0.04] lg:w-auto"
                />
              ))}
            </div>
          ) : ordered.length > 0 ? (
            <div className="flex min-w-max lg:min-w-0 lg:grid lg:grid-cols-6">
              {ordered.map((ticker, index) => {
                if (!ticker) return null;
                const href = `/markets/${symbolToSlug(ticker.symbol)}`;
                return (
                  <Link
                    key={ticker.symbol}
                    href={href}
                    className={`group flex w-[128px] shrink-0 flex-col justify-center gap-1 px-4 py-1 transition hover:opacity-90 sm:w-[140px] lg:w-auto lg:px-5 ${
                      index > 0 ? "border-l border-white/[0.06]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MarketCoinIcon baseAsset={ticker.baseAsset} size={22} />
                      <span className="text-sm font-semibold text-white">{ticker.baseAsset}</span>
                    </div>
                    <span className="text-sm font-medium tabular-nums text-white/95">
                      {formatMarketPrice(ticker.lastPrice)}
                    </span>
                    <span
                      className={`text-xs font-medium tabular-nums ${changeTone(ticker.priceChangePercent)}`}
                    >
                      {formatChangePercent(ticker.priceChangePercent)}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-xs" style={{ color: DASHBOARD_MUTED }}>
              Market data unavailable
            </p>
          )}
        </div>
      </div>
    </motion.section>
  );
}
