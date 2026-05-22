import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { cronAuthDebug, isVercelCronRequest } from "@/lib/cronAuth";

export const runtime = "nodejs";

/**
 * Vercel Cron (UTC): unlocks matured principal + daily tier profit accrual for all active investors.
 */
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

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
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

  const { data, error } = await supabase.rpc("run_daily_investment_jobs");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const report =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : { ok: true };

  return NextResponse.json({ ok: true, ...report });
}
