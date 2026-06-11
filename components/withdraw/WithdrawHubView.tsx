"use client";

import { AccountActionBlockedNotice } from "@/components/account/AccountActionBlockedNotice";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Users, Wallet } from "lucide-react";

const METHODS = [
  {
    href: "/withdraw/wallet",
    title: "Crypto wallet",
    badge: "On-chain",
    badgeClass: "border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#F5E6B3]",
    icon: Wallet,
    iconWrapClass: "bg-[#D4AF37]/15 text-[#D4AF37] ring-[#D4AF37]/25",
    titleClass: "text-[#F5E6B3]",
    cardClass:
      "border-white/[0.08] bg-white/[0.02] hover:border-[#D4AF37]/35 hover:bg-[#D4AF37]/[0.04]",
    description: "On-chain withdrawal direct to your preferred crypto wallet.",
  },
  {
    href: "/p2p/sell",
    title: "P2P marketplace",
    badge: "Live",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    icon: Users,
    iconWrapClass: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/25",
    titleClass: "text-emerald-100",
    cardClass:
      "border-white/[0.08] bg-white/[0.02] hover:border-emerald-500/35 hover:bg-emerald-500/[0.04]",
    description:
      "Sell accrued profits to verified merchants. Principal remains locked — use crypto wallet for matured principal.",
  },
] as const;

export function WithdrawHubView() {
  return (
    <main className="relative min-h-[calc(100dvh-3.5rem)] overflow-x-clip text-white lg:min-h-[calc(100dvh-3.5rem)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-5%,rgba(212,175,55,0.07)_0%,transparent_55%)]"
        aria-hidden
      />

      <div className="relative mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
        <AccountActionBlockedNotice action="withdraw" actionLabel="Withdrawals" />
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-[#D4AF37]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Dashboard
        </Link>

        <header className="mt-4 max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
            Receive funds
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Withdraw <span className="gold-gradient">funds</span>
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 sm:text-sm">
            Choose how you want to receive funds. On-chain withdrawals are reviewed before funds
            are sent.
          </p>
        </header>

        <div className="mt-8 grid gap-3 sm:max-w-2xl">
          {METHODS.map((method) => {
            const Icon = method.icon;
            return (
              <Link
                key={method.href}
                href={method.href}
                className={`group flex items-center gap-4 rounded-2xl border p-4 transition duration-200 sm:p-5 ${method.cardClass}`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${method.iconWrapClass}`}
                  aria-hidden
                >
                  <Icon className="h-5 w-5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-semibold sm:text-base ${method.titleClass}`}>
                      {method.title}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${method.badgeClass}`}
                    >
                      {method.badge}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-zinc-500 sm:text-[13px]">
                    {method.description}
                  </span>
                </span>

                <ChevronRight
                  className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-[#D4AF37]"
                  aria-hidden
                />
              </Link>
            );
          })}
        </div>

        <p className="mt-8 max-w-xl text-[11px] leading-relaxed text-zinc-600">
          P2P marketplace trades use withdrawable profits only. Locked and matured principal follow
          the crypto wallet withdrawal rules (30-day lock, then wallet).
        </p>
      </div>
    </main>
  );
}
