"use client";

import { useParams } from "next/navigation";

import { P2pOrderWorkspace } from "@/components/p2p/P2pOrderWorkspace";

export default function P2pOrderDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  if (!id) {
    return (
      <main className="relative min-h-screen p-6 text-white">
        <p className="text-red-400">Invalid order.</p>
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <P2pOrderWorkspace orderId={id} backHref="/p2p" backLabel="← Marketplace" embedded={false} />
      </div>
    </main>
  );
}
