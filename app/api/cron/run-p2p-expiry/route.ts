import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function bearerMatchesSecret(authHeader: string | null, secret: string): boolean {
  const prefix = "Bearer ";
  if (typeof authHeader !== "string" || !authHeader.startsWith(prefix)) {
    return false;
  }
  const token = authHeader.slice(prefix.length).trim();
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

/** Expire stale P2P merchant_orders (30m timeout). Uses service role; authorize with CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || !bearerMatchesSecret(authHeader, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
