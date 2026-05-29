"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import {
  isMerchantPresencePath,
  MERCHANT_PRESENCE_HEARTBEAT_MS,
  syncMerchantPresence,
} from "@/lib/merchantPresence";
import { useSupabase } from "@/lib/supabase";

/**
 * Syncs merchant_profiles.is_online + last_seen_at while the merchant console
 * or P2P trade page is open so investors see Online after refresh.
 */
export function MerchantPresenceBridge() {
  const supabase = useSupabase();
  const pathname = usePathname();
  const onSurfaceRef = useRef(false);
  const activeMerchantRef = useRef(false);

  useEffect(() => {
    let stopped = false;
    let heartbeatId: number | null = null;

    async function isActiveMerchant(): Promise<boolean> {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) return false;

      const { data } = await supabase
        .from("merchant_profiles")
        .select("status")
        .eq("user_id", session.user.id)
        .maybeSingle();

      return (data as { status?: string } | null)?.status === "active";
    }

    async function pingOnline() {
      if (stopped || !activeMerchantRef.current) return;
      await syncMerchantPresence(supabase, true);
    }

    async function getPresenceMode(): Promise<string> {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) return "auto";

      const { data } = await supabase
        .from("merchant_profiles")
        .select("presence_mode")
        .eq("user_id", session.user.id)
        .maybeSingle();

      return (data as { presence_mode?: string } | null)?.presence_mode ?? "auto";
    }

    async function pingOffline() {
      const mode = await getPresenceMode();
      if (mode === "manual_online") return;
      await syncMerchantPresence(supabase, false);
    }

    function clearHeartbeat() {
      if (heartbeatId !== null) {
        window.clearInterval(heartbeatId);
        heartbeatId = null;
      }
    }

    async function enterSurface() {
      const isActive = await isActiveMerchant();
      if (stopped) return;

      activeMerchantRef.current = isActive;
      onSurfaceRef.current = isActive;

      if (!isActive) return;

      if (document.visibilityState === "visible") {
        await pingOnline();
      }

      clearHeartbeat();
      heartbeatId = window.setInterval(() => {
        if (document.visibilityState === "visible" && onSurfaceRef.current) {
          void pingOnline();
        }
      }, MERCHANT_PRESENCE_HEARTBEAT_MS);
    }

    async function leaveSurface() {
      clearHeartbeat();
      const wasOn = onSurfaceRef.current;
      onSurfaceRef.current = false;
      activeMerchantRef.current = false;
      if (wasOn) {
        await pingOffline();
      }
    }

    void (async () => {
      if (!isMerchantPresencePath(pathname)) {
        await leaveSurface();
        return;
      }
      await enterSurface();
    })();

    const onVisibility = () => {
      if (!onSurfaceRef.current) return;
      if (document.visibilityState === "visible") {
        void pingOnline();
      } else {
        void pingOffline();
      }
    };

    const onPageHide = () => {
      if (onSurfaceRef.current) {
        void pingOffline();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      stopped = true;
      clearHeartbeat();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [pathname, supabase]);

  return null;
}
