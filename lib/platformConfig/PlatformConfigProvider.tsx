"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { FALLBACK_PLATFORM_CONFIG } from "@/lib/platformConfig/fallbacks";
import { PLATFORM_CONFIG_CHANGED_EVENT } from "@/lib/platformConfig/events";
import { fetchPlatformConfig } from "@/lib/platformConfig/fetch";
import type { PlatformConfig } from "@/lib/platformConfig/types";
import { useSupabase } from "@/lib/supabase";

type PlatformConfigContextValue = {
  config: PlatformConfig;
  loading: boolean;
  refresh: () => Promise<void>;
};

const PlatformConfigContext = createContext<PlatformConfigContextValue | null>(null);

const REALTIME_TABLES = ["investment_plans", "promotion_settings", "announcements"] as const;

export function PlatformConfigProvider({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const [config, setConfig] = useState<PlatformConfig>(FALLBACK_PLATFORM_CONFIG);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshAtRef = useRef(0);

  const refresh = useCallback(async () => {
    const next = await fetchPlatformConfig(supabase);
    setConfig(next);
    setLoading(false);
    lastRefreshAtRef.current = Date.now();
  }, [supabase]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void refresh();
    }, 120);
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchPlatformConfig(supabase).then((next) => {
      if (!cancelled) {
        setConfig(next);
        setLoading(false);
        lastRefreshAtRef.current = Date.now();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    const onConfigChanged = () => scheduleRefresh();
    window.addEventListener(PLATFORM_CONFIG_CHANGED_EVENT, onConfigChanged);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        const staleMs = Date.now() - lastRefreshAtRef.current;
        if (staleMs > 30_000) void refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener(PLATFORM_CONFIG_CHANGED_EVENT, onConfigChanged);
      document.removeEventListener("visibilitychange", onVisible);
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [refresh, scheduleRefresh]);

  useEffect(() => {
    const channel = supabase.channel("platform-config-live");

    for (const table of REALTIME_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => scheduleRefresh(),
      );
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, scheduleRefresh]);

  const value = useMemo(
    () => ({ config, loading, refresh }),
    [config, loading, refresh],
  );

  return (
    <PlatformConfigContext.Provider value={value}>{children}</PlatformConfigContext.Provider>
  );
}

export function usePlatformConfig(): PlatformConfigContextValue {
  const ctx = useContext(PlatformConfigContext);
  if (!ctx) {
    return {
      config: FALLBACK_PLATFORM_CONFIG,
      loading: false,
      refresh: async () => {},
    };
  }
  return ctx;
}
