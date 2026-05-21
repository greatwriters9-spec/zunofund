"use client";

import { useParams } from "next/navigation";

import { P2pOrderWorkspace } from "@/components/p2p/P2pOrderWorkspace";

export default function P2pOrderDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  if (!id) {
    return (
      <main className="relative min-h-screen bg-[#03060c] px-4 py-8 text-white pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="text-red-400">Invalid order.</p>
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,_rgba(212,175,55,0.08),_transparent_55%),#03060c] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-white">
      <div className="mx-auto w-full max-w-[1280px] px-3 pb-2 pt-2 sm:px-5 sm:pt-3">
        <P2pOrderWorkspace orderId={id} backHref="/p2p" backLabel="← Marketplace" embedded={false} />
      </div>
    </main>
  );
}
