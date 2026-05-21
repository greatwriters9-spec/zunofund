"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useSupabase } from "@/lib/supabase";

const INACTIVE_ALLOWED = new Set(["/merchant", "/merchant/profile"]);

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useSupabase();
  const [status, setStatus] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setStatus(null);
        return;
      }
      const { data } = await supabase
        .from("merchant_profiles")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      setStatus((data as { status?: string } | null)?.status ?? null);
    }
    void load();
  }, [supabase]);

  useEffect(() => {
    if (status === undefined) return;
    const path = pathname ?? "";
    if (status === "active" || status === null) return;
    if (!INACTIVE_ALLOWED.has(path)) {
      router.replace("/merchant");
    }
  }, [status, pathname, router]);

  if (status === undefined) {
    return <div className="min-h-screen bg-[#03060c]" aria-busy="true" />;
  }

  return children;
}
