"use client";

import { useParams } from "next/navigation";

import { P2pOrderWorkspace } from "@/components/p2p/P2pOrderWorkspace";

export default function P2pOrderDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  if (!id) {
    return (
      <main className="relative min-h-screen px-4 py-8 text-white pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="text-red-400">Invalid order.</p>
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] pb-[max(10px,env(safe-area-inset-bottom))] pt-[max(10px,env(safe-area-inset-top))] text-white">
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6 lg:py-8">
        <P2pOrderWorkspace orderId={id} backHref="/p2p" backLabel="← Marketplace" embedded={false} />
      </div>
    </main>
  );
}
