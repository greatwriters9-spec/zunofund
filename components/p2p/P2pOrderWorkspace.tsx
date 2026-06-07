"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ArrowLeft, ChevronDown, Clock, Lock } from "lucide-react";

import {
  DASHBOARD_CARD,
  DASHBOARD_MUTED,
  DASHBOARD_SUCCESS,
} from "@/components/dashboard/premium/dashboardStyles";

import { CancelModal } from "@/components/p2p/CancelModal";
import { DisputeModal } from "@/components/p2p/DisputeModal";
import type { ChatMessage } from "@/components/p2p/TradeChat";
import { TradeChat } from "@/components/p2p/TradeChat";
import { TradeMobileActionBar } from "@/components/p2p/TradeMobileActionBar";
import { TradeOrderBrief } from "@/components/p2p/TradeOrderBrief";
import { TradeSecurityBanner } from "@/components/p2p/TradeSecurityBanner";
import { tradeSummaryHeaderBadge } from "@/components/p2p/tradeSummaryUi";
import { MerchantNameLink } from "@/components/p2p/MerchantNameLink";
import { MerchantOfferAvatar } from "@/components/p2p/MerchantOfferAvatar";
import { MerchantReviewForm } from "@/components/p2p/MerchantReviewForm";
import {
  formatHMS,
  orderStatusHeadline,
  paymentMethodLabel,
} from "@/components/p2p/utils";
import { deriveTradePanels } from "@/components/p2p/deriveTradePanels";
import { expireStaleP2pOrders } from "@/lib/p2pExpiry";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";
import {
  createP2pProofSignedUrl,
  uploadP2pPaymentProof,
} from "@/lib/supabase/p2pProofs";
import { formatInvestorPresence } from "@/lib/investorPresence";
import {
  formatMerchantPresence,
  isMerchantEffectivelyOnline,
  type MerchantPresenceMode,
} from "@/lib/merchantPresence";
import { formatFiat } from "@/lib/currencies";
import { assetFromOfferSide, fmtAssetAmount } from "@/lib/p2pAssets";
import type { WorkspaceOrderRow } from "@/components/p2p/workspaceTypes";

export type { WorkspaceOrderRow } from "@/components/p2p/workspaceTypes";

export type P2pOrderWorkspaceProps = {
  orderId: string;
  /** When true, sizing fits the marketplace main column instead of standalone page padding. */
  embedded?: boolean;
  /** Prefer `onBack` for in-app flows; fallback is `Link` using `backHref`. */
  onBack?: () => void;
  backLabel?: string;
  /** Used when `onBack` is not provided (standalone order page). */
  backHref?: string;
  /** Admin dispute console — chat + resolve controls, no party trade actions. */
  adminMode?: boolean;
};

type OrderMessageRow = {
  id: string;
  sender_user_id: string;
  sender_role?: string | null;
  body: string;
  attachment_path: string | null;
  attachment_mime_type: string | null;
  attachment_name: string | null;
  created_at: string;
};

const linkCls =
  "inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#D4AF37] transition hover:text-[#F5E6B3]";
const innerCard =
  "rounded-xl border border-white/[0.06] bg-[rgba(12,17,28,0.72)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

function cleanAutomatedInstructionBody(raw: string): string {
  const t = raw.trim();
  const nl = t.indexOf("\n");
  if (nl > 0 && nl < 96 && t.slice(0, nl).trimEnd().endsWith(":")) {
    return t.slice(nl + 1).trim();
  }
  return t;
}

function deriveSummaryStrip(
  order: WorkspaceOrderRow,
  viewerIsMerchant: boolean,
  fiatTradeAmount: string | null,
  cryptoTradeAmount: string,
): { pay: string; receive: string } {
  const orderAsset = assetFromOfferSide(order.side);
  const creditAmt = order.usdt_credit_amount ?? order.btc_credit_amount ?? 0;
  const creditLabel = `≈ ${fmtAssetAmount(orderAsset, creditAmt)}`;
  const isInvestorBuy = order.side === "sell_usdt" || order.side === "sell_btc";

  if (isInvestorBuy) {
    if (viewerIsMerchant) {
      return {
        pay: creditLabel,
        receive: fiatTradeAmount ?? creditLabel,
      };
    }
    return {
      pay: fiatTradeAmount ?? cryptoTradeAmount,
      receive: creditLabel,
    };
  }

  if (viewerIsMerchant) {
    return {
      pay: fiatTradeAmount ?? "Fiat payout",
      receive: cryptoTradeAmount,
    };
  }
  return {
    pay: cryptoTradeAmount,
    receive: fiatTradeAmount ?? "Fiat payout",
  };
}

export function P2pOrderWorkspace({
  orderId: id,
  embedded = false,
  onBack,
  backLabel = "← Marketplace",
  backHref = "/p2p",
  adminMode = false,
}: P2pOrderWorkspaceProps) {
  const supabase = useSupabase();

  const [userId, setUserId] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(adminMode);
  const [order, setOrder] = useState<WorkspaceOrderRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeBusy, setDisputeBusy] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const [serverMessages, setServerMessages] = useState<OrderMessageRow[]>([]);
  const [chatSyncError, setChatSyncError] = useState<string | null>(null);
  const [chatSending, setChatSending] = useState(false);
  const [merchantListingName, setMerchantListingName] = useState<string | null>(null);
  const [merchantAvatarUrl, setMerchantAvatarUrl] = useState<string | null>(null);
  const [merchantPresence, setMerchantPresence] = useState<{
    is_online: boolean | null;
    last_seen_at: string | null;
    presence_mode: MerchantPresenceMode;
  } | null>(null);
  const [investorPresence, setInvestorPresence] = useState<{
    is_online: boolean | null;
    last_seen_at: string | null;
  } | null>(null);
  const [investorContact, setInvestorContact] = useState<{
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null>(null);
  const tradePanelsDerived = useMemo(() => {
    if (!order) return null;
    const merchantView = userId !== null && order.merchant_user_id === userId;
    return deriveTradePanels(order, merchantView);
  }, [order, userId]);

  const chatDisplayMessages: ChatMessage[] = useMemo(
    () =>
      serverMessages.map((r) => {
        const isAdminMsg = r.sender_role === "admin";
        return {
          id: r.id,
          kind: "user" as const,
          senderRole: isAdminMsg ? ("admin" as const) : ("party" as const),
          mine: Boolean(userId && r.sender_user_id === userId && !isAdminMsg),
          body: r.body,
          at: new Date(r.created_at),
          attachmentUrl: r.attachment_path,
          attachmentMimeType: r.attachment_mime_type,
          attachmentName: r.attachment_name,
        };
      }),
    [serverMessages, userId],
  );

  const tradeTimelineMessages = useMemo((): ChatMessage[] => {
    if (!order) return [];
    const isMerchView = Boolean(userId && order.merchant_user_id === userId);
    const anchor = order.created_at ? new Date(order.created_at) : new Date();

    const sys = (
      sid: string,
      body: string,
      tone: "default" | "success",
    ): ChatMessage => ({
      id: sid,
      kind: "system",
      systemTone: tone,
      hideTime: true,
      mine: false,
      body,
      at: anchor,
    });

    const out: ChatMessage[] = [];
    const st = order.status;

    if (st === "cancelled" || st === "completed_expired") {
      const body =
        st === "completed_expired"
          ? "Payment window expired — this trade was cancelled by the system. Do not send new funds."
          : "Trade cancelled — do not send new funds unless you jointly coordinate here.";
      out.push(sys("sys-cancelled", body, "default"));
      return out;
    }

    if (st === "disputed") {
      out.push(
        sys(
          "sys-disputed",
          "Dispute open — an admin is reviewing this trade. Release and cancel are paused.",
          "default",
        ),
      );
    }

    if (st === "paid" || st === "completed" || st === "disputed") {
      let paidBody: string;
      if (order.side === "sell_usdt" || order.side === "sell_btc") {
        paidBody = isMerchView
          ? "Buyer marked paid. Confirm fiat, then release when satisfied."
          : "Marked paid — merchant verifying.";
      } else {
        paidBody = isMerchView
          ? "Fiat payout marked sent; seller confirms before escrow release."
          : "Merchant marked payout sent — verify before releasing.";
      }
      out.push(sys("sys-milestone-paid", paidBody, "success"));
    }

    if (st === "completed") {
      out.push(sys("sys-milestone-complete", "Trade completed — balances refreshed.", "success"));
    }

    return out;
  }, [order, userId]);

  const instructionChatMessages = useMemo((): ChatMessage[] => {
    if (!order || !tradePanelsDerived) return [];
    const anchor = order.created_at ? new Date(order.created_at) : new Date();
    const isInvestorBuy = order.side === "sell_usdt" || order.side === "sell_btc";
    const viewerIsMerchant = Boolean(userId && order.merchant_user_id === userId);
    const out: ChatMessage[] = [];

    const instructionBody = tradePanelsDerived.instructionMarkdown.trim();
    if (instructionBody) {
      const automatedLabel = isInvestorBuy
        ? viewerIsMerchant
          ? "Pay-in coordinates"
          : "Payment instructions"
        : viewerIsMerchant
          ? "Payout coordinates"
          : "Payout mandate";

      const senderLabel = isInvestorBuy
        ? viewerIsMerchant
          ? "Listing (Automated)"
          : "Merchant (Automated)"
        : viewerIsMerchant
          ? "Platform (Automated)"
          : "Your mandate (Automated)";

      out.push({
        id: `auto-instructions-${order.id}`,
        kind: "automated",
        automatedLabel,
        senderLabel,
        mine: false,
        body: cleanAutomatedInstructionBody(instructionBody),
        at: anchor,
        hideTime: true,
      });
    }

    if (order.side === "buy_usdt" || order.side === "buy_btc") {
      const payout = (order.investor_payout_instructions ?? "").trim();
      if (payout) {
        out.push({
          id: `auto-payout-${order.id}`,
          kind: "automated",
          automatedLabel: viewerIsMerchant ? "Investor payout (fiat)" : "Your payout lane",
          senderLabel: viewerIsMerchant ? "Investor (Automated)" : "Platform (Automated)",
          mine: false,
          body: payout,
          at: anchor,
          hideTime: true,
        });
      }
    }

    return out;
  }, [order, tradePanelsDerived, userId]);

  const combinedChatMessages = useMemo(
    () => [...instructionChatMessages, ...tradeTimelineMessages, ...chatDisplayMessages],
    [instructionChatMessages, tradeTimelineMessages, chatDisplayMessages],
  );

  const load = useCallback(async () => {
    if (!id?.trim()) return;
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    if (user?.id) {
      const { data: adminFlag } = await supabase.rpc("is_admin", { check_uid: user.id });
      setIsAdminUser(Boolean(adminMode || adminFlag));
      await expireStaleP2pOrders(supabase);
    } else {
      setIsAdminUser(adminMode);
    }

    const { data: ord, error: qErr } = await supabase
      .from("merchant_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    setLoading(false);

    if (qErr) {
      setError(formatSupabaseError(qErr));
      setOrder(null);
      setMerchantListingName(null);
      setMerchantAvatarUrl(null);
      setMerchantPresence(null);
      setInvestorPresence(null);
      setInvestorContact(null);
      return;
    }

    if (!ord) {
      setOrder(null);
      setError(null);
      setMerchantListingName(null);
      setMerchantAvatarUrl(null);
      setMerchantPresence(null);
      setInvestorPresence(null);
      setInvestorContact(null);
      return;
    }

    const oid = ord.offer_id as string | null;
    const { data: off } =
      oid && oid.trim() !== ""
        ? await supabase
            .from("merchant_offers")
            .select("payment_instructions")
            .eq("id", oid)
            .maybeSingle()
        : { data: null };

    const viewerIsInvestor = user?.id === ord.investor_user_id;
    const viewerIsMerchant = user?.id === ord.merchant_user_id;

    setMerchantListingName(null);
    setMerchantAvatarUrl(null);
    setMerchantPresence(null);
    setInvestorPresence(null);
    setInvestorContact(null);

    if (viewerIsInvestor) {
      const { data: merchantProfData, error: merchantProfErr } = await supabase.rpc(
        "investor_get_order_merchant_profile",
        { p_order_id: id },
      );
      if (!merchantProfErr) {
        const merchantRow = (Array.isArray(merchantProfData) ? merchantProfData[0] : merchantProfData) as
          | {
              display_name?: string | null;
              is_online?: boolean | null;
              last_seen_at?: string | null;
              presence_mode?: MerchantPresenceMode | null;
              avatar_url?: string | null;
            }
          | null
          | undefined;
        if (merchantRow) {
          setMerchantListingName(merchantRow.display_name ?? null);
          setMerchantAvatarUrl(merchantRow.avatar_url?.trim() ? merchantRow.avatar_url.trim() : null);
          setMerchantPresence({
            is_online: merchantRow.is_online ?? null,
            last_seen_at: merchantRow.last_seen_at ?? null,
            presence_mode: merchantRow.presence_mode ?? "auto",
          });
        }
      } else {
        const { data: mpRow } = await supabase
          .from("merchant_profiles")
          .select("display_name, is_online, last_seen_at, presence_mode")
          .eq("user_id", ord.merchant_user_id)
          .maybeSingle();
        const merchantRow = mpRow as {
          display_name: string | null;
          is_online: boolean | null;
          last_seen_at: string | null;
          presence_mode?: MerchantPresenceMode | null;
        } | null;
        setMerchantListingName(merchantRow?.display_name ?? null);
        setMerchantPresence(
          merchantRow
            ? {
                is_online: merchantRow.is_online,
                last_seen_at: merchantRow.last_seen_at,
                presence_mode: merchantRow.presence_mode ?? "auto",
              }
            : null,
        );
      }
    } else if (viewerIsMerchant) {
      const { data: invData, error: invErr } = await supabase.rpc("merchant_get_order_investor_presence", {
        p_order_id: id,
      });
      if (!invErr) {
        const invRow = (Array.isArray(invData) ? invData[0] : invData) as
          | {
              is_online?: boolean;
              last_seen_at?: string | null;
              full_name?: string | null;
              email?: string | null;
              phone?: string | null;
              avatar_url?: string | null;
            }
          | null
          | undefined;
        if (invRow) {
          setInvestorPresence({
            is_online: Boolean(invRow.is_online),
            last_seen_at: invRow.last_seen_at ?? null,
          });
          setInvestorContact({
            full_name: invRow.full_name ?? null,
            email: invRow.email ?? null,
            phone: invRow.phone ?? null,
            avatar_url: invRow.avatar_url?.trim() ? invRow.avatar_url.trim() : null,
          });
        }
      }
    } else {
      const { data: mpRow } = await supabase
        .from("merchant_profiles")
        .select("display_name, is_online, last_seen_at, presence_mode")
        .eq("user_id", ord.merchant_user_id)
        .maybeSingle();
      const merchantRow = mpRow as {
        display_name: string | null;
        is_online: boolean | null;
        last_seen_at: string | null;
        presence_mode?: MerchantPresenceMode | null;
      } | null;
      setMerchantListingName(merchantRow?.display_name ?? null);
      setMerchantPresence(
        merchantRow
          ? {
              is_online: merchantRow.is_online,
              last_seen_at: merchantRow.last_seen_at,
              presence_mode: merchantRow.presence_mode ?? "auto",
            }
          : null,
      );
    }

    setOrder({
      ...(ord as WorkspaceOrderRow),
      merchant_offers: off ? { payment_instructions: off.payment_instructions } : null,
    });
    setError(null);
  }, [id, supabase]);

  const refreshMerchantPresence = useCallback(async () => {
    if (!id?.trim()) return;
    const { data, error: profErr } = await supabase.rpc("investor_get_order_merchant_profile", {
      p_order_id: id,
    });
    if (profErr) return;
    const row = (Array.isArray(data) ? data[0] : data) as
      | {
          display_name?: string | null;
          is_online?: boolean | null;
          last_seen_at?: string | null;
          presence_mode?: MerchantPresenceMode | null;
          avatar_url?: string | null;
        }
      | null
      | undefined;
    if (!row) return;
    setMerchantListingName(row.display_name ?? null);
    setMerchantAvatarUrl(row.avatar_url?.trim() ? row.avatar_url.trim() : null);
    setMerchantPresence({
      is_online: row.is_online ?? null,
      last_seen_at: row.last_seen_at ?? null,
      presence_mode: row.presence_mode ?? "auto",
    });
  }, [id, supabase]);

  const refreshInvestorPresence = useCallback(async () => {
    if (!id?.trim()) return;
    const { data, error: presErr } = await supabase.rpc("merchant_get_order_investor_presence", {
      p_order_id: id,
    });
    if (presErr) return;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      setInvestorPresence(null);
      setInvestorContact(null);
      return;
    }
    const typed = row as {
      is_online?: boolean;
      last_seen_at?: string | null;
      full_name?: string | null;
      email?: string | null;
      phone?: string | null;
      avatar_url?: string | null;
    };
    setInvestorPresence({
      is_online: Boolean(typed.is_online),
      last_seen_at: typed.last_seen_at ?? null,
    });
    setInvestorContact({
      full_name: typed.full_name ?? null,
      email: typed.email ?? null,
      phone: typed.phone ?? null,
      avatar_url: typed.avatar_url?.trim() ? typed.avatar_url.trim() : null,
    });
  }, [id, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!order) return;
    const t = window.setInterval(() => {
      if (userId === order.merchant_user_id) {
        void refreshInvestorPresence();
      } else if (userId === order.investor_user_id) {
        void refreshMerchantPresence();
      }
    }, 30_000);
    return () => window.clearInterval(t);
  }, [order, refreshInvestorPresence, refreshMerchantPresence, userId]);

  useEffect(() => {
    if (!order || userId !== order.merchant_user_id) return;
    void refreshInvestorPresence();
  }, [order, refreshInvestorPresence, userId]);

  useEffect(() => {
    setServerMessages([]);
    setChatSyncError(null);
  }, [id]);

  useEffect(() => {
    if (!id?.trim() || !order) return;
    let cancelled = false;
    setChatSyncError(null);

    void (async () => {
      const { data, error: mErr } = await supabase
        .from("merchant_order_messages")
        .select(
          "id, sender_user_id, sender_role, body, attachment_path, attachment_mime_type, attachment_name, created_at",
        )
        .eq("order_id", id)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (mErr) {
        setChatSyncError(formatSupabaseError(mErr));
        setServerMessages([]);
        return;
      }
      const rows = (data as OrderMessageRow[] | null) ?? [];
      const signedRows = await Promise.all(
        rows.map(async (row) => ({
          ...row,
          attachment_path: await createP2pProofSignedUrl(supabase, row.attachment_path),
        })),
      );
      setServerMessages(signedRows);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, order?.id, supabase]);

  useEffect(() => {
    if (!id?.trim() || !order) return;

    const channel = supabase
      .channel(`merchant_order_messages:${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "merchant_order_messages",
          filter: `order_id=eq.${id}`,
        },
        async (payload) => {
          const rawRow = payload.new as OrderMessageRow;
          const row = {
            ...rawRow,
            attachment_path: await createP2pProofSignedUrl(supabase, rawRow.attachment_path),
          };
          if (!row?.id) return;
          setServerMessages((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev;
            const next = [...prev, row];
            next.sort(
              (a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            );
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, order?.id, supabase]);

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!order || order.status !== "pending_payment") return;

    const msLeft = new Date(order.expires_at).getTime() - Date.now();
    let cancelled = false;

    const runExpiry = () => {
      void (async () => {
        await expireStaleP2pOrders(supabase);
        if (!cancelled) await load();
      })();
    };

    if (msLeft <= 0) {
      runExpiry();
      return () => {
        cancelled = true;
      };
    }

    const t = window.setTimeout(runExpiry, msLeft);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [order?.id, order?.status, order?.expires_at, load, supabase]);

  async function run(label: string, fn: () => Promise<{ error: unknown }>) {
    setBusy(label);
    setError(null);
    const { error: e } = await fn();
    setBusy(null);
    if (e) {
      setError(formatSupabaseError(e as Parameters<typeof formatSupabaseError>[0]));
      return;
    }
    await load();
  }

  async function sendTradeMessage(text: string) {
    const trimmed = text.trim().slice(0, 2000);
    if (!trimmed || !userId || !order || chatDisabled) return;
    setChatSending(true);
    setChatSyncError(null);
    const { data: inserted, error: insErr } = await supabase
      .from("merchant_order_messages")
      .insert({ order_id: order.id, body: trimmed })
      .select(
        "id, sender_user_id, sender_role, body, attachment_path, attachment_mime_type, attachment_name, created_at",
      )
      .single();

    setChatSending(false);

    if (insErr) {
      setChatSyncError(formatSupabaseError(insErr));
      return;
    }
    const row = inserted as OrderMessageRow | null;
    if (!row?.id) return;
    setServerMessages((prev) => {
      if (prev.some((r) => r.id === row.id)) return prev;
      const next = [...prev, row];
      next.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      return next;
    });
  }

  async function attachPaymentProof(file: File) {
    if (!userId || !order || chatDisabled) return;
    setChatSending(true);
    setChatSyncError(null);

    const uploaded = await uploadP2pPaymentProof(supabase, order.id, userId, file);
    if (!uploaded.ok) {
      setChatSending(false);
      setChatSyncError(uploaded.message);
      return;
    }

    const { data: inserted, error: insErr } = await supabase
      .from("merchant_order_messages")
      .insert({
        order_id: order.id,
        body: "Payment screenshot attached.",
        attachment_path: uploaded.path,
        attachment_mime_type: uploaded.mimeType,
        attachment_name: uploaded.fileName,
      })
      .select(
        "id, sender_user_id, sender_role, body, attachment_path, attachment_mime_type, attachment_name, created_at",
      )
      .single();

    setChatSending(false);

    if (insErr) {
      setChatSyncError(formatSupabaseError(insErr));
      return;
    }

    const row = inserted as OrderMessageRow | null;
    if (!row?.id) return;
    const signedRow = {
      ...row,
      attachment_path: await createP2pProofSignedUrl(supabase, row.attachment_path),
    };
    setServerMessages((prev) => {
      if (prev.some((r) => r.id === signedRow.id)) return prev;
      const next = [...prev, signedRow];
      next.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      return next;
    });
  }

  async function confirmInvestorCancel() {
    setCancelBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("investor_cancel_merchant_order", {
      p_order_id: id,
    });
    setCancelBusy(false);
    setCancelOpen(false);
    if (e) {
      setError(formatSupabaseError(e));
      return;
    }
    await load();
  }

  async function confirmOpenDispute(reason: string) {
    setDisputeBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("open_merchant_order_dispute", {
      p_order_id: id,
      p_reason: reason,
    });
    setDisputeBusy(false);
    setDisputeOpen(false);
    if (e) {
      setError(formatSupabaseError(e));
      return;
    }
    await load();
  }

  async function adminResolveDispute(winner: "investor" | "merchant") {
    setBusy(`resolve_${winner}`);
    setError(null);
    const { error: e } = await supabase.rpc("admin_resolve_merchant_order_dispute", {
      p_order_id: id,
      p_winner: winner,
      p_admin_note: resolveNote.trim() || null,
    });
    setBusy(null);
    if (e) {
      setError(formatSupabaseError(e));
      return;
    }
    setResolveNote("");
    await load();
  }

  async function confirmMerchantCancel() {
    setCancelBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("merchant_cancel_merchant_order", {
      p_order_id: id,
    });
    setCancelBusy(false);
    setCancelOpen(false);
    if (e) {
      setError(formatSupabaseError(e));
      return;
    }
    await load();
  }

  const partyOnOrder =
    Boolean(
      userId &&
        order &&
        (order.investor_user_id === userId || order.merchant_user_id === userId),
    );
  const canUseChat =
    partyOnOrder || (isAdminUser && order?.status === "disputed");
  const chatDisabled =
    !userId ||
    !order ||
    order.status === "cancelled" ||
    order.status === "completed_expired" ||
    !canUseChat;
  const chatInputDisabled = chatDisabled || chatSending;

  const detailRows = useMemo(() => {
    if (!order) return [];

    const merchantView = Boolean(userId && order.merchant_user_id === userId);
    const counterpartyRows =
      merchantView && investorContact
        ? [
            {
              label: "Counterparty",
              value: investorContact.full_name?.trim() || "—",
            },
            { label: "Email", value: investorContact.email?.trim() || "—" },
            {
              label: "Phone",
              value: investorContact.phone?.trim() || "Not provided",
            },
          ]
        : [];

    // Phase 3 fiat snapshot — locked at order open. NULL on legacy rows.
    const fiatCcy = (order.fiat_currency_code ?? "USD") || "USD";
    const fiatAmt = Number(order.fiat_amount ?? 0);
    const fxRate = Number(order.fx_rate_usd_at_open ?? 1);
    const showFiatRow = fiatCcy !== "USD" && fiatAmt > 0;
    const fiatLine = showFiatRow ? formatFiat(fiatAmt, fiatCcy, { showCode: true }) : null;
    const rateLine = showFiatRow
      ? `1 ${fiatCcy} = ${fxRate.toPrecision(4)} USD (locked at open)`
      : null;

    const orderAsset = assetFromOfferSide(order.side);
    const creditAmt = order.usdt_credit_amount ?? order.btc_credit_amount ?? 0;

    if (order.side === "sell_usdt" || order.side === "sell_btc") {
      return [
        ...counterpartyRows,
        { label: `Amount (${orderAsset})`, value: fmtAssetAmount(orderAsset, order.amount_requested) },
        { label: "Merchant fee", value: `${Number(order.rate_percentage)}%` },
        {
          label: "You receive (on-platform)",
          value: `≈ ${fmtAssetAmount(orderAsset, creditAmt)}`,
          emphasize: true,
        },
        ...(showFiatRow
          ? [
              {
                label: "You pay (fiat)",
                value: `${fiatLine} — settle via ${paymentMethodLabel(order.payment_method)}`,
                emphasize: true,
              },
              { label: "FX snapshot", value: rateLine ?? "" },
            ]
          : [{ label: "Fiat settlement", value: "Off-platform — coordinated in chat / listing" }]),
      ];
    }
    const escrowAmt = order.usdt_escrow_amount ?? order.btc_escrow_amount ?? 0;
    return [
      ...counterpartyRows,
      { label: `${orderAsset} locked`, value: fmtAssetAmount(orderAsset, escrowAmt) },
      { label: "Merchant fee", value: `${Number(order.rate_percentage)}%` },
      ...(showFiatRow
        ? [
            {
              label: "You receive (fiat)",
              value: `${fiatLine} via ${paymentMethodLabel(order.payment_method)}`,
              emphasize: true,
            },
            { label: "FX snapshot", value: rateLine ?? "" },
          ]
        : [
            {
              label: "You receive (fiat)",
              value: "Use your payout details below — the merchant sends there",
              emphasize: true,
            },
          ]),
    ];
  }, [order, userId, investorContact]);

  if (!id?.trim()) {
    return (
      <div className="rounded-md border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        Invalid order.
      </div>
    );
  }

  if (loading && !order) {
    return (
      <div
        className={`${DASHBOARD_CARD} flex min-h-[20rem] flex-col items-center justify-center gap-3`}
        style={{ color: DASHBOARD_MUTED }}
      >
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
        <p className="text-sm font-medium">Loading trade…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className={`${DASHBOARD_CARD} px-6 py-10 text-center`}>
        <p style={{ color: DASHBOARD_MUTED }}>Order not found.</p>
        {onBack ? (
          <button type="button" onClick={onBack} className={`mt-4 inline-block ${linkCls}`}>
            {backLabel}
          </button>
        ) : (
          <Link href={backHref} className={`mt-4 inline-block ${linkCls}`}>
            {backLabel}
          </Link>
        )}
      </div>
    );
  }

  const isInvestor = userId === order.investor_user_id;
  const isMerchant = userId === order.merchant_user_id;

  const expires = new Date(order.expires_at).getTime();
  const leftSec =
    order.status === "pending_payment" ? Math.max(0, Math.floor((expires - Date.now()) / 1000)) : 0;
  void tick;

  // Only the party paying fiat may cancel (pending or after they marked paid, before release).
  const isDisputed = order.status === "disputed";

  const payerMayCancel =
    !isDisputed && (order.status === "pending_payment" || order.status === "paid");

  const showInvestorCancel =
    isInvestor &&
    payerMayCancel &&
    (order.side === "sell_usdt" || order.side === "sell_btc");

  const showMerchantCancel =
    isMerchant &&
    payerMayCancel &&
    (order.side === "buy_usdt" || order.side === "buy_btc");

  const btnPrimary =
    "inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#00C076] px-4 text-[14px] font-semibold text-white shadow-[0_4px_20px_rgba(0,192,118,0.22)] transition hover:bg-[#00D684] disabled:cursor-not-allowed disabled:opacity-50";

  const btnReleaseSell =
    "inline-flex h-11 w-full items-center justify-center rounded-xl bg-red-600 px-4 text-[14px] font-semibold text-white shadow-[0_4px_20px_rgba(220,38,38,0.2)] transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50";

  const btnCancel =
    "inline-flex h-11 w-full items-center justify-center rounded-xl border border-red-500/35 bg-red-500/[0.06] px-4 text-[14px] font-medium text-red-300 transition hover:border-red-500/55 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50";

  const counterpartName = isMerchant
    ? investorContact?.full_name?.trim() || "Investor"
    : merchantListingName ?? "Merchant";
  const counterpartAvatarUrl = isMerchant ? investorContact?.avatar_url : merchantAvatarUrl;

  const shellHeight = embedded
    ? "min-h-0 max-lg:min-h-[min(600px,92dvh)] lg:h-[min(700px,calc(100vh-10rem))] lg:min-h-[440px]"
    : "min-h-0 max-lg:h-full max-lg:min-h-0 lg:h-[calc(100dvh-4.5rem)] lg:min-h-[600px]";

  const effectiveBackHref = isMerchant ? "/merchant" : backHref;
  const effectiveBackLabel = isMerchant ? "← Merchant dashboard" : backLabel;

  const backControl =
    onBack != null ? (
      <button type="button" onClick={onBack} className={linkCls}>
        {effectiveBackLabel}
      </button>
    ) : (
      <Link href={effectiveBackHref} className={linkCls}>
        {effectiveBackLabel}
      </Link>
    );

  const showTimer = leftSec > 0;
  const payLabel = paymentMethodLabel(order.payment_method);
  const merchantOnline = isMerchantEffectivelyOnline(
    merchantPresence?.is_online,
    merchantPresence?.last_seen_at,
    merchantPresence?.presence_mode,
  );
  const merchantPresenceLabel = formatMerchantPresence(
    merchantPresence?.is_online,
    merchantPresence?.last_seen_at,
    merchantPresence?.presence_mode,
  );
  const investorPresenceUi = formatInvestorPresence(
    investorPresence?.is_online,
    investorPresence?.last_seen_at,
  );
  // Whoever is sending fiat (investor in sell_usdt, merchant in buy_usdt)
  // needs the fiat amount — not the USDT side. Snapshot was locked at open.
  const orderFiatCcy = (order.fiat_currency_code ?? "USD") || "USD";
  const orderFiatAmt = Number(order.fiat_amount ?? 0);
  const hasFiatSnapshot = orderFiatCcy !== "USD" && orderFiatAmt > 0;
  const fiatTradeAmount = hasFiatSnapshot ? formatFiat(orderFiatAmt, orderFiatCcy) : null;
  const orderAsset = assetFromOfferSide(order.side);
  const cryptoTradeAmount =
    order.side === "sell_usdt" || order.side === "sell_btc"
      ? fmtAssetAmount(orderAsset, order.amount_requested)
      : fmtAssetAmount(orderAsset, order.usdt_escrow_amount ?? order.btc_escrow_amount ?? 0);
  const tradeAmount = fiatTradeAmount ?? cryptoTradeAmount;

  const canMarkPaidInvestor =
    !adminMode &&
    isInvestor &&
    (order.side === "sell_usdt" || order.side === "sell_btc") &&
    order.status === "pending_payment";
  const canMarkPaidMerchant =
    !adminMode &&
    isMerchant &&
    (order.side === "buy_usdt" || order.side === "buy_btc") &&
    order.status === "pending_payment";
  const canReleaseMerchant =
    !adminMode &&
    !isDisputed &&
    isMerchant &&
    (order.side === "sell_usdt" || order.side === "sell_btc") &&
    (order.status === "pending_payment" || order.status === "paid");
  const canReleaseInvestor =
    !adminMode &&
    !isDisputed &&
    isInvestor &&
    (order.side === "buy_usdt" || order.side === "buy_btc") &&
    (order.status === "pending_payment" || order.status === "paid");
  const canOpenDispute =
    !adminMode && !isDisputed && order.status === "paid" && (isInvestor || isMerchant);
  const canAdminResolve = (adminMode || isAdminUser) && isDisputed;

  const summaryStrip = deriveSummaryStrip(order, isMerchant, fiatTradeAmount, cryptoTradeAmount);
  const statusHeadline = orderStatusHeadline(order.status);
  const headerStatusBadge = tradeSummaryHeaderBadge(order.status, isMerchant, order.side);
  const counterpartOnline = !isMerchant ? merchantOnline : investorPresenceUi.online;
  const counterpartPresenceText = !isMerchant ? merchantPresenceLabel : investorPresenceUi.primary;

  const mobileShowCancel = showInvestorCancel || showMerchantCancel;
  const mobilePrimary = canMarkPaidInvestor
    ? {
        label: "Mark as Paid",
        variant: "primary" as const,
        busyKey: "paid",
        onClick: () =>
          void run("paid", async () =>
            supabase.rpc("investor_mark_merchant_order_paid", {
              p_order_id: order.id,
              p_proof: null,
            }),
          ),
      }
    : canMarkPaidMerchant
      ? {
          label: "Mark as Paid",
          variant: "primary" as const,
          busyKey: "mc_mark_paid",
          onClick: () =>
            void run("mc_mark_paid", async () =>
              supabase.rpc("merchant_mark_buy_order_paid", {
                p_order_id: order.id,
                p_proof: null,
              }),
            ),
        }
      : canReleaseMerchant
        ? {
            label: `Release ${orderAsset}`,
            variant: "release" as const,
            busyKey: "release",
            onClick: () =>
              void run("release", async () =>
                supabase.rpc("merchant_release_buy_order", { p_order_id: order.id }),
              ),
          }
        : canReleaseInvestor
          ? {
              label: `Release ${orderAsset}`,
              variant: "release" as const,
              busyKey: "release_sell",
              onClick: () =>
                void run("release_sell", async () =>
                  supabase.rpc("investor_release_merchant_buy_order", {
                    p_order_id: order.id,
                  }),
                ),
            }
          : canOpenDispute
            ? {
                label: "Open Dispute",
                variant: "dispute" as const,
                busyKey: "dispute",
                onClick: () => setDisputeOpen(true),
              }
            : null;

  const mobileShowActionBar = Boolean(userId && (mobilePrimary || mobileShowCancel));

  const mobileBack =
    onBack != null ? (
      <button
        type="button"
        onClick={onBack}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#D4AF37] active:bg-white/[0.06] lg:hidden"
        aria-label="Go back"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
    ) : (
      <Link
        href={effectiveBackHref}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#D4AF37] active:bg-white/[0.06] lg:hidden"
        aria-label="Go back"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
    );

  return (
    <>
      <div
        className={`relative flex w-full min-w-0 flex-col overflow-hidden text-white ${
          embedded
            ? "rounded-xl border border-white/[0.06] bg-[rgba(12,17,28,0.85)] shadow-[0_4px_16px_rgba(0,0,0,0.2)] backdrop-blur-md"
            : "max-lg:h-full max-lg:rounded-none max-lg:border-0 max-lg:bg-[#05070D] max-lg:shadow-none lg:rounded-2xl lg:border lg:border-white/[0.06] lg:bg-[rgba(12,17,28,0.85)] lg:shadow-[0_4px_16px_rgba(0,0,0,0.2)] lg:backdrop-blur-md"
        }`}
      >
        <div className={`relative flex w-full min-h-0 flex-col ${shellHeight}`}>
          <div className="hidden shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] bg-[rgba(8,12,20,0.55)] px-4 py-2 backdrop-blur-md sm:px-5 lg:flex">
            {backControl}
            <span
              className="font-mono text-[10px] tabular-nums"
              style={{ color: DASHBOARD_MUTED }}
            >
              #{order.id.slice(0, 8)}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
            <aside className="hidden w-full shrink-0 flex-col gap-2 overflow-y-auto border-white/[0.06] bg-[rgba(8,12,20,0.35)] px-3 py-3 lg:flex lg:w-[252px] lg:border-r [scrollbar-width:thin]">
              <div className={`hidden p-4 lg:block ${innerCard}`}>
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[#F5E6B3]">
                  <Lock className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                  {orderStatusHeadline(order.status)}
                </div>
                {showTimer ? (
                  <p className="mt-2 text-[12px]" style={{ color: DASHBOARD_MUTED }}>
                    Time left:{" "}
                    <span className="font-mono font-semibold text-[#F5E6B3]">{formatHMS(leftSec)}</span>
                  </p>
                ) : null}
              </div>

              {error ? (
                <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2.5 text-[12.5px] text-red-200">
                  {error}
                </div>
              ) : null}

              <details className={`group p-3 sm:p-4 [&_summary::-webkit-details-marker]:hidden ${innerCard}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#D4AF37]/85">
                  Offer terms
                  <ChevronDown
                    className="h-4 w-4 text-[#D4AF37]/70 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[12px] text-zinc-300">
                  Instant release · {payLabel}
                </p>
                {canMarkPaidInvestor || canMarkPaidMerchant ? (
                  <p className="mt-2 text-[12px] leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
                    {canMarkPaidInvestor ? (
                      <>
                        Make a payment of{" "}
                        <span className="font-semibold text-white">{tradeAmount}</span>
                        {hasFiatSnapshot ? (
                          <span className="text-zinc-500">
                            {" "}
                            (~{cryptoTradeAmount})
                          </span>
                        ) : null}{" "}
                        using <span className="font-semibold text-white">{payLabel}</span> and press{" "}
                        <span className="font-semibold text-emerald-300">“Mark as Paid”</span> below.
                      </>
                    ) : (
                      <>
                        Send{" "}
                        <span className="font-semibold text-white">{tradeAmount}</span>
                        {hasFiatSnapshot ? (
                          <span className="text-zinc-500"> (~{cryptoTradeAmount} escrow)</span>
                        ) : null}{" "}
                        to the seller&apos;s payout details, then press{" "}
                        <span className="font-semibold text-emerald-300">“Mark as Paid”</span>.
                      </>
                    )}
                  </p>
                ) : null}
              </details>

              {userId ? (
                <div className="hidden space-y-2 lg:block">
                  {canMarkPaidInvestor ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void run("paid", async () =>
                          supabase.rpc("investor_mark_merchant_order_paid", {
                            p_order_id: order.id,
                            p_proof: null,
                          }),
                        )
                      }
                      className={btnPrimary}
                    >
                      {busy === "paid" ? "Saving…" : "Mark as Paid"}
                    </button>
                  ) : null}

                  {canMarkPaidMerchant ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void run("mc_mark_paid", async () =>
                          supabase.rpc("merchant_mark_buy_order_paid", {
                            p_order_id: order.id,
                            p_proof: null,
                          }),
                        )
                      }
                      className={btnPrimary}
                    >
                      {busy === "mc_mark_paid" ? "Saving…" : "Mark as Paid"}
                    </button>
                  ) : null}

                  {canReleaseMerchant ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void run("release", async () =>
                          supabase.rpc("merchant_release_buy_order", { p_order_id: order.id }),
                        )
                      }
                      className={btnPrimary}
                    >
                      {busy === "release" ? "Releasing…" : `Release ${orderAsset}`}
                    </button>
                  ) : null}

                  {canReleaseInvestor ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void run("release_sell", async () =>
                          supabase.rpc("investor_release_merchant_buy_order", {
                            p_order_id: order.id,
                          }),
                        )
                      }
                      className={btnReleaseSell}
                    >
                      {busy === "release_sell" ? "Releasing…" : `Release ${orderAsset}`}
                    </button>
                  ) : null}

                  {canOpenDispute ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => setDisputeOpen(true)}
                      className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/[0.08] px-4 text-[14px] font-semibold text-amber-200 transition hover:border-amber-400/55 hover:bg-amber-500/12 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Open dispute
                    </button>
                  ) : null}

                  {showInvestorCancel || showMerchantCancel ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => setCancelOpen(true)}
                      className={btnCancel}
                    >
                      Cancel
                    </button>
                  ) : null}

                  {canAdminResolve ? (
                    <div className="mt-2 space-y-2 rounded-xl border border-violet-500/30 bg-violet-500/[0.08] p-3">
                      <p className="text-[12px] font-semibold text-violet-200">Admin resolution</p>
                      <textarea
                        value={resolveNote}
                        onChange={(e) => setResolveNote(e.target.value)}
                        rows={2}
                        maxLength={500}
                        placeholder="Optional note to both parties…"
                        className="w-full resize-none rounded-xl border border-violet-500/25 bg-black/40 px-3 py-2 text-[12px] text-white outline-none focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/15"
                      />
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void adminResolveDispute("investor")}
                        className={btnPrimary}
                      >
                        {busy === "resolve_investor" ? "Awarding…" : "Award crypto to investor"}
                      </button>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void adminResolveDispute("merchant")}
                        className={btnCancel}
                      >
                        {busy === "resolve_merchant" ? "Awarding…" : "Award crypto to merchant"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p
                  className={`rounded-xl px-3 py-2.5 text-[12.5px] ${innerCard}`}
                  style={{ color: DASHBOARD_MUTED }}
                >
                  Sign in to mark paid or cancel.
                </p>
              )}

              <details className={`group [&_summary::-webkit-details-marker]:hidden ${innerCard}`}>
                <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-[13px] font-semibold text-[#F5E6B3]">
                  Trade actions
                  <ChevronDown
                    className="h-4 w-4 text-[#D4AF37]/70 transition-transform group-open:rotate-0 -rotate-90"
                    aria-hidden
                  />
                </summary>
                <div
                  className="space-y-2 border-t border-white/[0.06] px-4 py-3 text-[12.5px]"
                  style={{ color: DASHBOARD_MUTED }}
                >
                  <p>
                    After marking paid, either party can open a dispute so an admin can review chat proof
                    and award escrow.
                  </p>
                  {order.proof_of_payment ? (
                    <p className="break-all">
                      Ref:{" "}
                      <span className="font-mono text-zinc-300">{order.proof_of_payment}</span>
                    </p>
                  ) : null}
                </div>
              </details>

              {isInvestor && order.status === "completed" ? (
                <MerchantReviewForm orderId={order.id} />
              ) : null}

              <details className={`group [&_summary::-webkit-details-marker]:hidden ${innerCard}`}>
                <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-[13px] font-semibold text-[#F5E6B3]">
                  Trade information
                  <ChevronDown
                    className="h-4 w-4 text-[#D4AF37]/70 transition-transform group-open:rotate-0 -rotate-90"
                    aria-hidden
                  />
                </summary>
                <dl className="divide-y divide-white/[0.06] border-t border-white/[0.06] text-[12.5px]">
                  {detailRows.map(({ label, value }) => (
                    <div key={label} className="flex items-start justify-between gap-3 px-4 py-2.5">
                      <dt style={{ color: DASHBOARD_MUTED }}>{label}</dt>
                      <dd className="text-right font-medium text-white">{value}</dd>
                    </div>
                  ))}
                  <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <dt style={{ color: DASHBOARD_MUTED }}>Payment method</dt>
                    <dd className="text-right font-medium text-white">{payLabel}</dd>
                  </div>
                </dl>
              </details>
            </aside>

            <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#05070D]">
              <div className="flex shrink-0 items-center justify-between gap-2 overflow-hidden whitespace-nowrap border-b border-white/[0.06] bg-[rgba(8,12,20,0.45)] px-2 py-2 backdrop-blur-md sm:px-4 lg:px-5 lg:py-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {mobileBack}
                  <MerchantOfferAvatar
                    avatarUrl={counterpartAvatarUrl}
                    displayName={counterpartName}
                    size="sm"
                    className="h-8 w-8 shrink-0 ring-[#D4AF37]/35 lg:h-9 lg:w-9"
                  />
                  <div className="min-w-0 overflow-hidden">
                    <p className="truncate text-[13px] font-semibold text-white lg:text-[15px]">
                      {!isMerchant ? (
                        <MerchantNameLink
                          merchantUserId={order.merchant_user_id}
                          className="text-white hover:text-[#D4AF37]"
                        >
                          {counterpartName}
                        </MerchantNameLink>
                      ) : (
                        counterpartName
                      )}
                    </p>
                    <p
                      className={`flex items-center gap-1 truncate text-[9px] font-bold uppercase tracking-wide lg:text-[10.5px] ${
                        counterpartOnline ? "text-[#00C076]" : "text-yellow-300"
                      }`}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={
                          counterpartOnline
                            ? { backgroundColor: DASHBOARD_SUCCESS }
                            : { backgroundColor: "#facc15" }
                        }
                        aria-hidden
                      />
                      <span className="truncate">{counterpartPresenceText}</span>
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="max-w-[5.5rem] truncate rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2 py-0.5 text-[8px] font-semibold text-[#F5E6B3] sm:max-w-none sm:text-[10px]">
                    {headerStatusBadge}
                  </span>
                  {showTimer ? (
                    <div className="flex items-center gap-1 rounded-lg border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-2 py-0.5">
                      <Clock className="h-3 w-3 shrink-0 text-[#D4AF37]" aria-hidden />
                      <span className="font-mono text-[11px] font-semibold tabular-nums text-[#F5E6B3] lg:text-xs">
                        {formatHMS(leftSec)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              {tradePanelsDerived ? (
                <TradeOrderBrief
                  status={order.status}
                  orderSide={order.side}
                  viewerIsMerchant={isMerchant}
                  paymentMethod={payLabel}
                  payLabel={summaryStrip.pay}
                  receiveLabel={summaryStrip.receive}
                />
              ) : (
                <div
                  className="border-b border-white/[0.06] px-5 py-3 text-[12.5px] sm:px-6"
                  style={{ color: DASHBOARD_MUTED }}
                >
                  Loading trade context…
                </div>
              )}

              {order.status !== "completed" &&
              order.status !== "cancelled" &&
              order.status !== "completed_expired" ? (
                <TradeSecurityBanner />
              ) : null}

              <details className={`group mx-2.5 shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.02] sm:mx-3 lg:hidden [&_summary::-webkit-details-marker]:hidden`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]/85">
                  Offer terms
                  <ChevronDown
                    className="h-3.5 w-3.5 text-[#D4AF37]/70 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="border-t border-white/[0.06] px-3 py-2 text-[11px] leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
                  <p className="text-zinc-300">Instant release · {payLabel}</p>
                  {(canMarkPaidInvestor || canMarkPaidMerchant) && (
                    <p className="mt-1.5">
                      Pay <span className="font-semibold text-white">{tradeAmount}</span> via{" "}
                      <span className="font-semibold text-white">{payLabel}</span>, then use Mark as Paid.
                    </p>
                  )}
                </div>
              </details>

              {chatSyncError ? (
                <div className="shrink-0 border-b border-red-500/30 bg-red-500/10 px-5 py-2 text-[12.5px] text-red-200 sm:px-6">
                  {chatSyncError}
                </div>
              ) : null}

              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <TradeChat
                  counterpartLabel={counterpartName}
                  messages={combinedChatMessages}
                  onSend={(t) => void sendTradeMessage(t)}
                  onAttach={(file) => void attachPaymentProof(file)}
                  disabled={chatInputDisabled}
                  mobileActionBar={mobileShowActionBar}
                  placeholder={
                    chatSending
                      ? "Sending…"
                      : isAdminUser && isDisputed
                        ? "Write as admin mediator…"
                        : "Type a message…"
                  }
                />
              </div>

              {mobileShowActionBar ? (
                <TradeMobileActionBar
                  primaryLabel={mobilePrimary?.label ?? null}
                  primaryBusy={mobilePrimary ? busy === mobilePrimary.busyKey : false}
                  primaryDisabled={busy !== null}
                  primaryVariant={mobilePrimary?.variant ?? "primary"}
                  onPrimary={mobilePrimary?.onClick}
                  showCancel={mobileShowCancel}
                  cancelDisabled={busy !== null}
                  onCancel={() => setCancelOpen(true)}
                />
              ) : null}
            </section>
          </div>
        </div>
      </div>

      <CancelModal
        open={cancelOpen}
        onClose={() => {
          if (!cancelBusy) setCancelOpen(false);
        }}
        busy={cancelBusy}
        onConfirm={() => {
          if (isInvestor) void confirmInvestorCancel();
          else if (isMerchant) void confirmMerchantCancel();
        }}
      />

      <DisputeModal
        open={disputeOpen}
        busy={disputeBusy}
        onClose={() => {
          if (!disputeBusy) setDisputeOpen(false);
        }}
        onConfirm={(reason) => void confirmOpenDispute(reason)}
      />
    </>
  );
}
