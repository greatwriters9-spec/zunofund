import Link from "next/link";

import { InvestorP2pTradeHistoryView } from "@/components/p2p/InvestorP2pTradeHistoryView";

/** Investor P2P ledger: Active, Completed, and Cancelled in full-page layout */
export default function P2pInvestorTradeHistoryPage() {
  return (
    <div className="min-h-screen bg-[#03060c] text-white">
      <header className="border-b border-[#D4AF37]/12 bg-black/35 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <Link
              href="/p2p"
              className="text-sm font-medium text-[#D4AF37] transition hover:text-[#F5E6B3]"
            >
              ← P2P marketplace
            </Link>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              <span className="text-[#D4AF37]">P2P</span> transaction history
            </h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-500">
              Every trade where you acted as investor — grouped by lifecycle. Tap a row to open the ticket.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 self-start rounded-xl border border-[#D4AF37]/30 bg-black/30 px-4 py-2 text-sm font-medium text-[#F5E6B3] transition hover:border-[#D4AF37]/50 hover:bg-black/45 sm:self-auto"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <InvestorP2pTradeHistoryView />
      </main>
    </div>
  );
}
