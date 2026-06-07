"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { SpotDepositPanel } from "@/components/spot/SpotDepositPanel";

function SpotDepositPageContent() {
  const searchParams = useSearchParams();
  const asset = searchParams.get("asset") ?? "USDT";
  const network = searchParams.get("network") ?? undefined;

  return (
    <main className="min-h-screen bg-[#05080F] px-4 py-6 text-white">
      <div className="mx-auto w-full max-w-lg">
        <p className="text-xs text-zinc-500">
          <Link href="/" className="text-[#D4AF37] hover:underline">
            ← Back to home
          </Link>
        </p>

        <h1 className="mt-4 text-2xl font-bold text-white">
          Spot <span className="text-[#D4AF37]">Deposit</span>
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Select your asset and network to fund your Zuno wallet on-chain.
        </p>

        <div className="mt-6">
          <SpotDepositPanel initialAsset={asset} initialNetworkId={network} />
        </div>
      </div>
    </main>
  );
}

export default function SpotDepositPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#05080F] text-sm text-zinc-500">
          Loading deposit screen…
        </main>
      }
    >
      <SpotDepositPageContent />
    </Suspense>
  );
}
