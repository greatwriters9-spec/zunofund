"use client";

import Link from "next/link";

export default function WithdrawHubPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-white">
      <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 backdrop-blur-xl">
        <h1 className="mb-2 text-4xl font-bold text-yellow-500">Withdraw funds</h1>
        <p className="mb-8 text-zinc-500">
          Choose how you want to receive funds.
        </p>

        <div className="flex flex-col gap-4">
          <Link
            href="/withdraw/wallet"
            className="rounded-2xl border border-zinc-700 bg-zinc-950/80 px-6 py-5 font-semibold transition hover:border-yellow-500/50 hover:bg-zinc-900"
          >
            <span className="block text-lg text-white">Withdraw to wallet</span>
            <span className="mt-1 block text-sm font-normal text-zinc-500">
              On-chain withdrawal request for admin approval (existing flow).
            </span>
          </Link>

          <Link
            href="/p2p/sell"
            className="rounded-2xl border border-red-500/35 bg-red-500/10 px-6 py-5 font-semibold transition hover:border-red-500/55 hover:bg-red-500/[0.14]"
          >
            <span className="block text-lg text-red-400">Sell to merchant</span>
            <span className="mt-1 block text-sm font-normal text-zinc-500">
              Match a merchant, receive fiat off-platform, then release USDT — deduction applies like an approved exchange withdrawal.
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
