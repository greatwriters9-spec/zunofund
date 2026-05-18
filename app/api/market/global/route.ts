import { NextResponse } from "next/server";

/** Proxied CoinGecko global metrics — cached at the edge to avoid per-client rate limits. */
export async function GET() {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/global", {
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { totalMarketCapUsd: null },
        { status: 200, headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
      );
    }

    const payload = (await res.json()) as {
      data?: { total_market_cap?: { usd?: number } };
    };
    const v = payload?.data?.total_market_cap?.usd;
    const totalMarketCapUsd = typeof v === "number" ? v : null;

    return NextResponse.json(
      { totalMarketCapUsd },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { totalMarketCapUsd: null },
      { status: 200, headers: { "Cache-Control": "public, s-maxage=60" } },
    );
  }
}
