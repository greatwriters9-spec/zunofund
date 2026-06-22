"use client";

import { useEffect, useState } from "react";

import { AdminCommunicationCenter } from "@/components/admin/communication/AdminCommunicationCenter";

export default function AdminCommunicationPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <p className="text-zinc-400">Loading communication center…</p>;
  }

  return <AdminCommunicationCenter />;
}
