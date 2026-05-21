import { NextResponse } from "next/server";

/** CoinGecko BTC USD spot — informational for P2P reference display only (cached). */
export async function GET() {
  try {
    const qs = new URLSearchParams({
      ids: "bitcoin",
      vs_currencies: "usd",
    });
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?${qs.toString()}`,
      {
        next: { revalidate: 120 },
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        { btcUsd: null },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          },
        },
      );
    }

    const payload = (await res.json()) as Record<
      string,
      | {
          usd?: number;
        }
      | undefined
    >;
    const btcUsd = typeof payload?.bitcoin?.usd === "number" ? payload.bitcoin.usd : null;

    return NextResponse.json(
      { btcUsd },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { btcUsd: null },
      { status: 200, headers: { "Cache-Control": "public, s-maxage=60" } },
    );
  }
}
