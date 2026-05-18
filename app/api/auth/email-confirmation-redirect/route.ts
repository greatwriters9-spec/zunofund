import { NextResponse } from "next/server";

import { sanitizeNextParam } from "@/lib/authLinks";
import { getRequestSiteOrigin } from "@/lib/server-site-origin";

export const runtime = "nodejs";

/**
 * Canonical `emailRedirectTo` for signUp — matches the **actual** host the browser used
 * (custom domain vs vercel.app vs localhost), avoiding wrong links when env is stale.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = sanitizeNextParam(url.searchParams.get("next")) ?? "/dashboard";
  const origin = getRequestSiteOrigin(request);
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
  return NextResponse.json({ redirectTo });
}
