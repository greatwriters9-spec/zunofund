import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";

/** Pretty URLs like /markets/btc-usdt → internal /markets/detail?slug=btc-usdt */
function marketSlugFromPath(pathname: string): string | null {
  const match = /^\/markets\/([^/]+)$/.exec(pathname);
  if (!match) return null;
  const segment = decodeURIComponent(match[1]).trim().toLowerCase();
  if (!segment || segment === "detail") return null;
  return segment;
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
}

export async function proxy(request: NextRequest) {
  const sessionResponse = await updateSession(request);
  const slug = marketSlugFromPath(request.nextUrl.pathname);

  if (!slug) {
    return sessionResponse;
  }

  const url = request.nextUrl.clone();
  url.pathname = "/markets/detail";
  url.searchParams.set("slug", slug);

  const rewrite = NextResponse.rewrite(url);
  copyCookies(sessionResponse, rewrite);
  return rewrite;
}

export const config = {
  matcher: [
    /*
     * Run for all paths except static assets and images.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|apk)$).*)",
  ],
};
