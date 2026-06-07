"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  ArrowLeft,
  CheckCheck,
  MessageCircle,
  Wallet,
  ArrowDownCircle,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";

import {
  DASHBOARD_BG,
  DASHBOARD_CARD,
  DASHBOARD_GOLD,
  DASHBOARD_MUTED,
} from "@/components/dashboard/premium/dashboardStyles";
import { formatUsdAmountsInText } from "@/lib/formatMoney";
import { coerceRpcBigint, formatSupabaseError, useSupabase } from "@/lib/supabase";
import { notificationsOwnerOrFilter } from "@/lib/notificationQuery";

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

type FilterTab = "all" | "unread" | "read";

const SECTION_LABEL =
  "text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90";

const GHOST_BTN =
  "inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:border-[#D4AF37]/35 hover:text-[#F5E6B3] disabled:cursor-not-allowed disabled:opacity-40";

function filterPillClass(active: boolean): string {
  const base =
    "shrink-0 touch-manipulation whitespace-nowrap rounded-xl border px-3.5 py-2 text-[11px] font-semibold transition sm:px-4 sm:text-xs";
  return active
    ? `${base} border-[#D4AF37]/40 bg-[#D4AF37]/[0.08] text-[#F5E6B3] ring-1 ring-[#D4AF37]/20`
    : `${base} border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:border-[#D4AF37]/25 hover:text-zinc-300`;
}

function typeStyles(type: string) {
  const t = type.toLowerCase();
  if (t.includes("support")) {
    return {
      Icon: MessageCircle,
      chip: "text-sky-300 bg-sky-500/15 ring-sky-500/30",
      iconWrap: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
    };
  }
  if (t.includes("referral")) {
    return {
      Icon: TrendingUp,
      chip: "text-yellow-300 bg-yellow-500/15 ring-yellow-500/30",
      iconWrap: "bg-yellow-500/10 text-yellow-400 ring-yellow-500/20",
    };
  }
  if (t.includes("reward_eligible")) {
    return {
      Icon: TrendingUp,
      chip: "text-amber-300 bg-amber-500/15 ring-amber-500/30",
      iconWrap: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
    };
  }
  if (
    t.includes("reward_unlocked") ||
    t.includes("tier_upgraded") ||
    t.includes("elite_status") ||
    t.includes("merchant_access")
  ) {
    return {
      Icon: TrendingUp,
      chip: "text-[#F5E6B3] bg-[#D4AF37]/15 ring-[#D4AF37]/30",
      iconWrap: "bg-[#D4AF37]/10 text-[#D4AF37] ring-[#D4AF37]/25",
    };
  }
  if (t.includes("p2p") || t.includes("trade")) {
    return {
      Icon: MessageCircle,
      chip: "text-[#F5E6B3] bg-[#D4AF37]/15 ring-[#D4AF37]/30",
      iconWrap: "bg-[#D4AF37]/10 text-[#D4AF37] ring-[#D4AF37]/25",
    };
  }
  if (t.includes("deposit")) {
    return {
      Icon: Wallet,
      chip: "text-emerald-300 bg-emerald-500/15 ring-emerald-500/30",
      iconWrap: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
    };
  }
  if (t.includes("withdraw")) {
    return {
      Icon: ArrowDownCircle,
      chip: "text-amber-300 bg-amber-500/15 ring-amber-500/30",
      iconWrap: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
    };
  }
  if (t.includes("profit")) {
    return {
      Icon: TrendingUp,
      chip: "text-violet-300 bg-violet-500/15 ring-violet-500/30",
      iconWrap: "bg-violet-500/10 text-violet-400 ring-violet-500/20",
    };
  }
  if (t.includes("principal")) {
    return {
      Icon: TrendingUp,
      chip: "text-cyan-300 bg-cyan-500/15 ring-cyan-500/35",
      iconWrap: "bg-cyan-500/10 text-cyan-400 ring-cyan-500/20",
    };
  }
  if (t.includes("ticket")) {
    return {
      Icon: MessageCircle,
      chip: "text-amber-300 bg-amber-500/15 ring-amber-500/30",
      iconWrap: "bg-amber-500/12 text-amber-300 ring-amber-500/20",
    };
  }
  return {
    Icon: ShieldAlert,
    chip: "text-zinc-300 bg-white/[0.06] ring-white/[0.08]",
    iconWrap: "bg-white/[0.04] text-[#D4AF37] ring-white/[0.08]",
  };
}

export default function NotificationsPage() {
  const supabase = useSupabase();

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");

  const fetchNotifications = useCallback(async (opts?: { background?: boolean }) => {
    const background = opts?.background === true;

    if (!background) {
      setLoading(true);
    }
    setFetchError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const email =
      typeof user?.email === "string" ? user.email.trim() : "";

    if (!user?.id || !email) {
      setNotifications([]);
      if (!background) setLoading(false);
      return;
    }

    const ownerFilter = notificationsOwnerOrFilter({
      userId: user.id,
      investorEmail: email,
    });

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .or(ownerFilter)
      .order("created_at", { ascending: false });

    if (error) {
      setNotifications([]);
      setFetchError(formatSupabaseError(error));
      if (!background) setLoading(false);
      return;
    }

    setNotifications((data as NotificationRow[]) || []);
    if (!background) setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const h = () => {
      void fetchNotifications({ background: true });
    };
    window.addEventListener("tp:investor-notification", h as EventListener);
    return () => {
      window.removeEventListener("tp:investor-notification", h as EventListener);
    };
  }, [fetchNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.is_read !== true).length,
    [notifications],
  );

  const visibleList = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((n) => n.is_read !== true);
    }
    if (filter === "read") {
      return notifications.filter((n) => n.is_read === true);
    }
    return notifications;
  }, [notifications, filter]);

  async function markAsRead(id: string) {
    setActionError(null);
    const { error, data } = await supabase.rpc(
      "mark_investor_notifications_read",
      { p_ids: [id] },
    );

    if (error) {
      setActionError(formatSupabaseError(error));
      return;
    }

    const updated = coerceRpcBigint(data);
    if (updated < 1) {
      await fetchNotifications({ background: true });
      window.dispatchEvent(new CustomEvent("tp:investor-notifications-sync"));
      return;
    }

    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id
          ? { ...notification, is_read: true }
          : notification,
      ),
    );

    window.dispatchEvent(new CustomEvent("tp:investor-notifications-sync"));
  }

  async function markAllAsRead() {
    const unreadIds = notifications
      .filter((n) => n.is_read !== true)
      .map((n) => n.id);

    if (unreadIds.length === 0) return;

    setActionError(null);
    const { error, data } = await supabase.rpc(
      "mark_investor_notifications_read",
      { p_ids: unreadIds },
    );

    if (error) {
      setActionError(formatSupabaseError(error));
      return;
    }

    const updated = coerceRpcBigint(data);
    if (updated < unreadIds.length) {
      await fetchNotifications({ background: true });
    }

    setNotifications((prev) =>
      prev.map((notification) =>
        unreadIds.includes(notification.id)
          ? { ...notification, is_read: true }
          : notification,
      ),
    );

    window.dispatchEvent(new CustomEvent("tp:investor-notifications-sync"));
  }

  if (loading) {
    return (
      <div className="relative min-h-full text-white" style={{ backgroundColor: DASHBOARD_BG }}>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,rgba(212,175,55,0.08)_0%,transparent_70%)]"
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-[1400px] space-y-4 px-4 py-8 sm:px-6">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className={`h-24 animate-pulse ${DASHBOARD_CARD}`} />
          <div className={`h-12 animate-pulse ${DASHBOARD_CARD}`} />
          <div className={`h-64 animate-pulse ${DASHBOARD_CARD}`} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full text-white" style={{ backgroundColor: DASHBOARD_BG }}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,rgba(212,175,55,0.08)_0%,transparent_70%)]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-[1400px] space-y-5 px-4 py-5 pb-6 sm:space-y-6 sm:px-6 sm:pb-8 lg:py-8">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium transition hover:text-[#D4AF37]"
            style={{ color: DASHBOARD_MUTED }}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Dashboard
          </Link>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className={SECTION_LABEL}>Inbox</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
                Notifications
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
                Deposits, withdrawals, profits, P2P trades, and support — all in one place.
              </p>
            </div>
            {unreadCount > 0 ? (
              <div className={`${DASHBOARD_CARD} px-4 py-3 text-center sm:min-w-[7rem]`}>
                <p className={SECTION_LABEL}>Unread</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: DASHBOARD_GOLD }}>
                  {unreadCount}
                </p>
              </div>
            ) : null}
          </div>
        </motion.header>

        {(fetchError || actionError) && (
          <div
            className="rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200/95 backdrop-blur-sm"
            role="alert"
          >
            {fetchError || actionError}
          </div>
        )}

        <div className={`${DASHBOARD_CARD} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5`}>
          <div>
            <p className={SECTION_LABEL}>Inbox status</p>
            <p className="mt-1 text-sm text-zinc-300">
              {unreadCount === 0 ? (
                "You're all caught up."
              ) : (
                <>
                  <span className="font-semibold tabular-nums" style={{ color: DASHBOARD_GOLD }}>
                    {unreadCount}
                  </span>{" "}
                  unread {unreadCount === 1 ? "alert" : "alerts"}
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => markAllAsRead()}
              disabled={unreadCount === 0}
              className={GHOST_BTN}
            >
              <CheckCheck size={16} aria-hidden />
              Mark all read
            </button>
            <Link href="/dashboard" className={GHOST_BTN}>
              <ArrowLeft size={16} aria-hidden />
              Dashboard
            </Link>
          </div>
        </div>

        <nav aria-label="Filter notifications" className={`${DASHBOARD_CARD} p-2 sm:p-2.5`}>
          <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                ["all", `All (${notifications.length})`] as const,
                [
                  "unread",
                  `Unread (${notifications.filter((n) => n.is_read !== true).length})`,
                ] as const,
                [
                  "read",
                  `Read (${notifications.filter((n) => n.is_read === true).length})`,
                ] as const,
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={filterPillClass(filter === key)}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        <div className={`overflow-hidden ${DASHBOARD_CARD}`}>
          {visibleList.length > 0 ? (
            <div className="divide-y divide-white/[0.06]">
              {visibleList.map((notification) => {
                const { Icon, chip, iconWrap } = typeStyles(
                  notification.type || "",
                );
                const unread = notification.is_read !== true;
                const rowInner = (
                  <div
                    className={`flex gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5 ${
                      unread ? "border-l-2 border-[#D4AF37]/50 bg-[#D4AF37]/[0.03]" : ""
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${iconWrap}`}
                    >
                      <Icon size={18} aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h2 className="text-sm font-semibold text-white sm:text-[15px]">
                          {notification.title}
                        </h2>
                        <div className="flex shrink-0 items-center gap-2">
                          {unread ? (
                            <span
                              className="rounded-full bg-[#D4AF37]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#F5E6B3] ring-1 ring-[#D4AF37]/30"
                            >
                              New
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-wide" style={{ color: DASHBOARD_MUTED }}>
                              Read
                            </span>
                          )}
                          <time
                            className="text-[11px] tabular-nums"
                            style={{ color: DASHBOARD_MUTED }}
                            dateTime={notification.created_at}
                          >
                            {new Date(notification.created_at).toLocaleString()}
                          </time>
                        </div>
                      </div>
                      <p
                        className={`mt-1.5 inline-flex rounded-md px-2 py-0.5 text-[10px] capitalize tracking-wide ring-1 ${chip}`}
                      >
                        {(notification.type || "update").replace(/-/g, " ")}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                        {formatUsdAmountsInText(notification.message)}
                      </p>
                    </div>
                  </div>
                );

                return unread ? (
                  <button
                    type="button"
                    key={notification.id}
                    onClick={() => markAsRead(notification.id)}
                    className="block w-full text-left transition hover:bg-white/[0.02]"
                    title="Tap to mark as read"
                  >
                    {rowInner}
                  </button>
                ) : (
                  <div key={notification.id} className="opacity-85">
                    {rowInner}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03] ring-1 ring-[#D4AF37]/10">
                <Bell
                  className="text-[#D4AF37]/60"
                  size={28}
                  strokeWidth={1.5}
                  aria-hidden
                />
              </div>
              <h2 className="text-base font-semibold text-white">
                {filter === "unread"
                  ? "No unread notifications."
                  : filter === "read"
                    ? "No read notifications yet."
                    : "No notifications yet."}
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: DASHBOARD_MUTED }}>
                Alerts from payouts, support, and your portfolio show here.
              </p>
              <Link
                href="/dashboard"
                className="mt-6 inline-flex items-center gap-2 text-xs font-semibold transition hover:text-[#F5E6B3]"
                style={{ color: DASHBOARD_GOLD }}
              >
                <ArrowLeft size={14} aria-hidden />
                Back to dashboard
              </Link>
            </div>
          )}
        </div>

        <p className="text-xs leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
          Unread rows mark as read when opened. Use Mark all read to clear the badge quickly.
        </p>
      </div>
    </div>
  );
}
