"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";

export default function DepositHubPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4 text-white sm:p-6">
      <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 backdrop-blur-xl sm:p-8">
        <h1 className="mb-2 text-4xl font-bold text-yellow-500">Deposit funds</h1>
        <p className="mb-8 text-zinc-500">
          Choose how you want to fund your account.
        </p>

        <div className="flex flex-col gap-4">
          <Link
            href="/deposit/exchange"
            className="group relative flex h-32 flex-col justify-center overflow-hidden rounded-2xl border border-[#D4AF37]/35 bg-gradient-to-br from-[#D4AF37]/15 via-[#D4AF37]/8 to-amber-500/10 px-6 py-5 font-semibold shadow-[0_0_30px_-10px_rgba(212,175,55,0.55)] transition hover:border-[#F5E6B3]/70 hover:shadow-[0_0_40px_-8px_rgba(212,175,55,0.75)]"
          >
            <span className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-[#D4AF37]/25 blur-2xl" aria-hidden />
            <span className="relative flex items-center gap-2">
              <Wallet className="h-5 w-5 shrink-0 text-[#D4AF37]" aria-hidden />
              <span className="text-lg font-extrabold tracking-tight text-[#D4AF37]">Crypto Wallet</span>
              <span className="rounded-full bg-[#D4AF37]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#F5E6B3] ring-1 ring-[#D4AF37]/40">
                On‑chain
              </span>
            </span>
            <span className="relative mt-1 block text-sm font-normal text-zinc-400">
              On‑chain deposit straight from your preferred crypto wallet.
            </span>
          </Link>

          <Link
            href="/p2p/buy"
            className="group relative flex h-32 flex-col justify-center overflow-hidden rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-500/15 via-emerald-500/8 to-yellow-500/10 px-6 py-5 font-semibold shadow-[0_0_30px_-10px_rgba(16,185,129,0.55)] transition hover:border-emerald-400/70 hover:shadow-[0_0_40px_-8px_rgba(16,185,129,0.7)]"
          >
            <span className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-emerald-500/20 blur-2xl" aria-hidden />
            <span className="relative flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-emerald-300">P2P</span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-400/40">
                Live
              </span>
            </span>
            <span className="relative mt-1 block text-sm font-normal text-zinc-400">
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
