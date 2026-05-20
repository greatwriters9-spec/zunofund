"use client";

import Link from "next/link";

export default function DepositHubPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-white">
      <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 backdrop-blur-xl">
        <h1 className="mb-2 text-4xl font-bold text-yellow-500">Deposit funds</h1>
        <p className="mb-8 text-zinc-500">
          Choose how you want to fund your account.
        </p>

        <div className="flex flex-col gap-4">
          <Link
            href="/deposit/exchange"
            className="rounded-2xl border border-zinc-700 bg-zinc-950/80 px-6 py-5 font-semibold transition hover:border-yellow-500/50 hover:bg-zinc-900"
          >
            <span className="block text-lg text-white">Deposit from exchange</span>
            <span className="mt-1 block text-sm font-normal text-zinc-500">
              Send crypto from your wallet or exchange (existing flow).
            </span>
          </Link>

          <Link
            href="/p2p/buy"
            className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-6 py-5 font-semibold transition hover:border-yellow-500/60"
          >
            <span className="block text-lg text-yellow-400">Buy from merchant</span>
            <span className="mt-1 block text-sm font-normal text-zinc-500">
              Pay a verified merchant via bank / mobile money / etc. USDT is credited after they confirm.
            </span>
          </Link>
        </div>

        <p className="mt-8 text-center text-sm text-zinc-600">
          <Link href="/dashboard" className="text-yellow-600 hover:underline">
            ← Back to dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
