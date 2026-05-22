import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { cronAuthDebug, isVercelCronRequest } from "@/lib/cronAuth";

export const runtime = "nodejs";

/** Expire stale P2P merchant_orders (30m timeout). */
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

  const { data: n, error } = await supabase.rpc("merchant_expire_stale_orders");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expired: n ?? 0 });
}
