"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchWithRetry } from "@/lib/markets/fetchWithRetry";
import type { MarketTicker, MarketTickersResponse } from "@/lib/markets/types";

const POLL_MS = 5000;

export function useMarketTickers(symbols: readonly string[]) {
  const [tickers, setTickers] = useState<MarketTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const firstLoad = useRef(true);

  const symbolKey = symbols.join(",");

  const load = useCallback(async () => {
    if (firstLoad.current) setLoading(true);
    try {
      const qs = new URLSearchParams({ symbols: symbolKey });
      const res = await fetchWithRetry(`/api/market/binance/tickers?${qs}`, {
        cache: "no-store",
      });
      const body = (await res.json()) as MarketTickersResponse;
      const rows = body.tickers ?? [];
      setTickers(rows);
      setFetchedAt(body.fetchedAt ?? null);
      setStale(Boolean(body.stale));
      setError(
        !body.stale && rows.length > 0 ? null : (body.error ?? null),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load markets");
      if (firstLoad.current) setTickers([]);
    } finally {
      setLoading(false);
      firstLoad.current = false;
    }
  }, [symbolKey]);

  useEffect(() => {
    firstLoad.current = true;
    setLoading(true);
  }, [symbolKey]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  return { tickers, loading, error, stale, fetchedAt, refresh: load };
}
