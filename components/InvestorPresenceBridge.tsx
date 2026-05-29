"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import {
  INVESTOR_PRESENCE_HEARTBEAT_MS,
  isInvestorTradePath,
  syncInvestorPresence,
  tradeOrderIdFromPath,
} from "@/lib/investorPresence";
import { useSupabase } from "@/lib/supabase";

/**
 * Marks investors online only while their P2P trade page is open (visible tab).
 */
export function InvestorPresenceBridge() {
  const supabase = useSupabase();
  const pathname = usePathname();
  const onTradeRef = useRef(false);
  const orderIdRef = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let heartbeatId: number | null = null;

    async function resolveInvestorOnOrder(orderId: string): Promise<boolean> {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return false;

      const { data } = await supabase
        .from("merchant_orders")
        .select("investor_user_id")
        .eq("id", orderId)
        .maybeSingle();

      return (data as { investor_user_id?: string } | null)?.investor_user_id === uid;
    }

    async function pingOnline() {
      if (stopped || !onTradeRef.current) return;
      await syncInvestorPresence(supabase, true);
    }

    async function pingOffline() {
      if (!onTradeRef.current) return;
      await syncInvestorPresence(supabase, false);
    }

    function clearHeartbeat() {
      if (heartbeatId !== null) {
        window.clearInterval(heartbeatId);
        heartbeatId = null;
      }
    }

    async function enterTrade(orderId: string) {
      const isInvestor = await resolveInvestorOnOrder(orderId);
      if (stopped || !isInvestor) {
        onTradeRef.current = false;
        orderIdRef.current = null;
        return;
      }

      onTradeRef.current = true;
      orderIdRef.current = orderId;

      if (document.visibilityState === "visible") {
        await pingOnline();
      }

      clearHeartbeat();
      heartbeatId = window.setInterval(() => {
        if (document.visibilityState === "visible" && onTradeRef.current) {
          void pingOnline();
        }
      }, INVESTOR_PRESENCE_HEARTBEAT_MS);
    }

    async function leaveTrade() {
      clearHeartbeat();
      const wasOn = onTradeRef.current;
      onTradeRef.current = false;
      orderIdRef.current = null;
      if (wasOn) {
        await pingOffline();
      }
    }

    void (async () => {
      if (!isInvestorTradePath(pathname)) {
        await leaveTrade();
        return;
      }

      const orderId = tradeOrderIdFromPath(pathname);
      if (!orderId) {
        await leaveTrade();
        return;
      }

      if (orderIdRef.current !== orderId) {
        await leaveTrade();
      }

      await enterTrade(orderId);
    })();

    const onVisibility = () => {
      if (!onTradeRef.current) return;
      if (document.visibilityState === "visible") {
        void pingOnline();
      } else {
        void pingOffline();
      }
    };

    const onPageHide = () => {
      if (onTradeRef.current) {
        void pingOffline();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && onTradeRef.current) {
        void pingOffline();
      }
    });

    return () => {
      stopped = true;
      authSub.unsubscribe();
      clearHeartbeat();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      if (onTradeRef.current) {
        void pingOffline();
      }
    };
  }, [pathname, supabase]);

  return null;
}
