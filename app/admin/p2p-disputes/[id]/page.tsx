"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { P2pOrderWorkspace } from "@/components/p2p/P2pOrderWorkspace";

export default function AdminP2pDisputeDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  if (!id) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        Invalid order id.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href="/admin/p2p-disputes"
        className="text-sm font-medium text-[#D4AF37] transition hover:text-[#F5E6B3]"
      >
        ← All disputes
      </Link>
      <P2pOrderWorkspace
        orderId={id}
        adminMode
        embedded={false}
        backHref="/admin/p2p-disputes"
        backLabel="← Disputes"
      />
    </div>
  );
}
