"use client";

import { useParams } from "next/navigation";

import { P2pOrderWorkspace } from "@/components/p2p/P2pOrderWorkspace";

export default function P2pOrderDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  if (!id) {
    return (
      <main className="relative min-h-screen overflow-x-clip bg-[#05070D] px-4 py-8 text-white pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="text-red-400">Invalid order.</p>
      </main>
    );
  }

  return (
    <main className="relative max-lg:fixed max-lg:inset-0 max-lg:flex max-lg:flex-col max-lg:overflow-hidden max-lg:bg-[#05070D] min-h-[100dvh] overflow-x-clip bg-[#05070D] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-white lg:min-h-[100dvh]">
      <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-48 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,rgba(212,175,55,0.04)_0%,transparent_70%)] lg:block" aria-hidden />
      <div className="relative mx-auto flex w-full max-w-[1400px] flex-1 flex-col max-lg:h-full max-lg:max-w-none max-lg:px-0 max-lg:py-0 lg:px-6 lg:py-8">
        <P2pOrderWorkspace orderId={id} backHref="/p2p" backLabel="← Marketplace" embedded={false} />
      </div>
    </main>
  );
}
