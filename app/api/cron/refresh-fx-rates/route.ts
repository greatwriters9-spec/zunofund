import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { cronAuthDebug, isVercelCronRequest } from "@/lib/cronAuth";
import {
  type RateRow,
  fetchCryptoRates,
  fetchFiatRates,
  withBaselines,
} from "@/lib/exchangeRates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Refresh `exchange_rates` from upstream APIs. */
export async function GET(request: Request) {
  if (!isVercelCronRequest(request)) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        hint: "Set CRON_SECRET in Vercel Production env, or disable Deployment Protection for cron. See cronAuth debug.",
        debug: cronAuthDebug(request),
      },
      { status: 401 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Missing Supabase URL or service role key" },
      { status: 500 },
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const fetched: RateRow[] = [];
  const errors: string[] = [];
  const settled = await Promise.allSettled([fetchCryptoRates(), fetchFiatRates()]);
  for (const r of settled) {
    if (r.status === "fulfilled") fetched.push(...r.value);
    else errors.push(String(r.reason?.message ?? r.reason ?? "unknown"));
  }

  if (fetched.length === 0) {
    return NextResponse.json(
      { ok: false, refreshed: 0, errors },
      { status: errors.length ? 502 : 200 },
    );
  }

  const now = new Date().toISOString();
  const payload = withBaselines(fetched).map((r) => ({
    code: r.code,
    usd_value: r.usd_value,
    source: r.source,
    fetched_at: now,
  }));

  const { error: upsertErr } = await supabase
    .from("exchange_rates")
    .upsert(payload, { onConflict: "code" });

  if (upsertErr) {
    return NextResponse.json({ ok: false, error: upsertErr.message, errors }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    refreshed: payload.length,
    fetched_at: now,
    sources: Array.from(new Set(payload.map((p) => p.source))),
    upstream_errors: errors,
  });
}
