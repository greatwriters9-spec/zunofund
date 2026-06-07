"use client";

import { useEffect, useMemo, useState } from "react";

import {
  DEFAULT_PLATFORM_DEPOSIT_NETWORKS,
  normalizePlatformDepositNetworkRows,
  type PlatformDepositNetwork,
} from "@/lib/platformDepositNetworks";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

export function usePlatformDepositNetworks() {
  const supabase = useSupabase();
  const [networks, setNetworks] = useState<PlatformDepositNetwork[]>(
    DEFAULT_PLATFORM_DEPOSIT_NETWORKS,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDepositNetworks() {
      const { data, error: queryError } = await supabase
        .from("platform_deposit_networks")
        .select("id, asset, network_name, network_label, wallet_address, sort_order, is_active, updated_at")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (cancelled) return;

      if (queryError) {
        setError(formatSupabaseError(queryError));
        setNetworks(DEFAULT_PLATFORM_DEPOSIT_NETWORKS);
      } else {
        setError(null);
        const normalized = normalizePlatformDepositNetworkRows(data);
        setNetworks(normalized.length > 0 ? normalized : DEFAULT_PLATFORM_DEPOSIT_NETWORKS);
      }

      setLoading(false);
    }

    void loadDepositNetworks();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const activeNetworks = useMemo(
    () => networks.filter((network) => network.is_active),
    [networks],
  );

  return { networks: activeNetworks, loading, error };
}
