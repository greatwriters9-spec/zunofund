import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  type FxRateMap,
  type RateRow,
  FX_STALE_AFTER_MS,
  fetchCryptoRates,
  fetchFiatRates,
  withBaselines,
} from "@/lib/exchangeRates";

export const runtime = "nodejs";
// We manage our own caching via the DB. Don't let Next freeze the response.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ExchangeRateRow = {
  code: string;
  usd_value: number;
  source: string;
  fetched_at: string;
  updated_at: string;
};

/**
 * Public read endpoint for FX rates.
 *
 * Behaviour: read all rates from `exchange_rates`. If the most recent
 * `fetched_at` is older than `FX_STALE_AFTER_MS`, kick off a refresh
 * **after** returning the cached response so the next caller gets fresh
 * numbers without waiting (poor man's stale-while-revalidate).
 *
 * Response shape:
 *   {
 *     rates: { USD: 1, USDT: 1, KES: 0.00775, BTC: 70123.45, ... },
 *     fetched_at: "2026-05-20T14:00:00Z",
 *     stale: false
 *   }
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !anon) {
    return NextResponse.json({ error: "Supabase env not configured" }, { status: 500 });
  }

  const reader = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await reader
    .from("exchange_rates")
    .select("code, usd_value, source, fetched_at, updated_at")
    .order("code", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as ExchangeRateRow[];
  const rates: FxRateMap = {};
  let mostRecentFetchedAt = 0;
  for (const r of rows) {
    rates[r.code] = Number(r.usd_value);
    const t = Date.parse(r.fetched_at);
    if (Number.isFinite(t) && t > mostRecentFetchedAt) mostRecentFetchedAt = t;
  }

  const stale = mostRecentFetchedAt > 0 && Date.now() - mostRecentFetchedAt > FX_STALE_AFTER_MS;

  // Lazy refresh in the background when service-role is available — never block.
  if (stale && serviceKey) {
    void refreshInBackground(url, serviceKey).catch(() => {
      /* swallow — next caller will retry */
    });
  }

  return NextResponse.json(
    {
      rates,
      fetched_at: mostRecentFetchedAt > 0 ? new Date(mostRecentFetchedAt).toISOString() : null,
      stale,
    },
    {
      headers: {
        // Edge / CDN can keep this for 60s; clients can hold for 30s.
        "cache-control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}

async function refreshInBackground(url: string, serviceKey: string): Promise<void> {
  const writer = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const fetched: RateRow[] = [];
  const settled = await Promise.allSettled([fetchCryptoRates(), fetchFiatRates()]);
  for (const r of settled) {
    if (r.status === "fulfilled") fetched.push(...r.value);
  }
  if (fetched.length === 0) return;

  const now = new Date().toISOString();
  const payload = withBaselines(fetched).map((r) => ({
    code: r.code,
    usd_value: r.usd_value,
    source: r.source,
    fetched_at: now,
  }));

  await writer.from("exchange_rates").upsert(payload, { onConflict: "code" });
}
