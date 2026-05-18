import { NextResponse } from "next/server";

import { getRequestSiteOrigin } from "@/lib/server-site-origin";

export const runtime = "nodejs";

/**
 * Canonical `redirectTo` for `resetPasswordForEmail` — same host the browser used
 * (custom domain vs vercel.app vs localhost), matching signup’s email-confirmation-redirect pattern.
 */
export async function GET(request: Request) {
  const origin = getRequestSiteOrigin(request);
  const redirectTo = `${origin}/reset-password`;
  return NextResponse.json({ redirectTo });
}
