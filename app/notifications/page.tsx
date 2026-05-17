"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

function typeStyles(type: string) {
  const t = type.toLowerCase();
  if (t.includes("support")) {
    return {
      Icon: MessageCircle,
      chip: "text-sky-300 bg-sky-500/15 border-sky-500/30",
      iconWrap: "bg-sky-500/10 text-sky-400",
    };
  }
  if (t.includes("deposit")) {
    return {
      Icon: Wallet,
      chip: "text-green-400 bg-green-500/15 border-green-500/30",
      iconWrap: "bg-green-500/10 text-green-400",
    };
  }
  if (t.includes("withdraw")) {
    return {
      Icon: ArrowDownCircle,
      chip: "text-amber-300 bg-amber-500/15 border-amber-500/30",
      iconWrap: "bg-amber-500/10 text-amber-400",
    };
  }
  if (t.includes("profit")) {
    return {
      Icon: TrendingUp,
      chip: "text-violet-300 bg-violet-500/15 border-violet-500/30",
      iconWrap: "bg-violet-500/10 text-violet-400",
    };
  }
  if (t.includes("principal")) {
    return {
      Icon: TrendingUp,
      chip: "text-cyan-300 bg-cyan-500/15 border-cyan-500/35",
      iconWrap: "bg-cyan-500/10 text-cyan-400",
    };
  }
  if (t.includes("ticket")) {
    return {
      Icon: MessageCircle,
      chip: "text-amber-300 bg-amber-500/15 border-amber-500/30",
      iconWrap: "bg-amber-500/12 text-amber-300",
    };
  }
  return {
    Icon: ShieldAlert,
    chip: "text-zinc-300 bg-zinc-800 border-zinc-700",
    iconWrap: "bg-zinc-800 text-yellow-500",
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
      <div className="min-h-screen text-white flex items-center justify-center text-zinc-400">
        Loading notifications…
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <div className="relative z-10 mx-auto max-w-7xl p-5 md:p-7">
        <header className="mb-5 border-b border-zinc-800/80 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Inbox
              </p>
              <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                Notifications
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                Same layout as your dashboard — deposits, withdrawals, profits,
                support.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="shrink-0 text-xs font-semibold text-yellow-500 transition hover:text-yellow-400"
            >
              ← Dashboard
            </Link>
          </div>
        </header>

        {(fetchError || actionError) && (
          <div
            className="mb-4 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            role="alert"
          >
            {fetchError || actionError}
          </div>
        )}

        <section className="mb-5 flex flex-col gap-3 border border-zinc-800/80 bg-zinc-950/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:rounded-lg">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Unread
            </p>
            <p className="text-lg font-semibold tabular-nums text-white">
              {unreadCount === 0 ? "—" : unreadCount}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => markAllAsRead()}
              disabled={unreadCount === 0}
              className="flex items-center gap-2 rounded-lg border border-zinc-700/90 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-yellow-500/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCheck size={16} aria-hidden />
              Mark all read
            </button>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700/90 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-yellow-500/40"
            >
              <ArrowLeft size={16} aria-hidden />
              Dashboard
            </Link>
          </div>
        </section>

        <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-zinc-800/80 px-1 pb-px">
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
              className={`shrink-0 border-b-2 px-3 pb-2 pt-1 text-sm font-medium transition ${
                filter === key
                  ? "border-yellow-500 text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden border border-zinc-800/80 bg-zinc-950/40 lg:rounded-lg">
          {visibleList.length > 0 ? (
            <div className="divide-y divide-zinc-800/80">
              {visibleList.map((notification) => {
                const { Icon, chip, iconWrap } = typeStyles(
                  notification.type || "",
                );
                const unread = notification.is_read !== true;
                const rowInner = (
                  <div className="flex gap-3 px-4 py-4 sm:px-5">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${iconWrap}`}
                    >
                      <Icon size={16} aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h2 className="text-sm font-semibold text-white">
                          {notification.title}
                        </h2>
                        <div className="flex shrink-0 items-center gap-2">
                          {unread ? (
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-yellow-500"
                              aria-hidden
                            />
                          ) : (
                            <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                              Read
                            </span>
                          )}
                          <span className="text-[11px] tabular-nums text-zinc-600">
                            {new Date(notification.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <p
                        className={`mt-1 inline-block text-[10px] capitalize tracking-wide ${chip} rounded border px-2 py-0.5`}
                      >
                        {(notification.type || "update").replace(/-/g, " ")}
                      </p>
                      <p className="mt-2 text-sm leading-snug text-zinc-400">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                );

                return unread ? (
                  <button
                    type="button"
                    key={notification.id}
                    onClick={() => markAsRead(notification.id)}
                    className="block w-full text-left transition hover:bg-zinc-900/40"
                    title="Tap to mark as read"
                  >
                    {rowInner}
                  </button>
                ) : (
                  <div key={notification.id} className="opacity-90">
                    {rowInner}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-14 text-center">
              <Bell
                className="mx-auto mb-4 text-zinc-700"
                size={36}
                strokeWidth={1.25}
                aria-hidden
              />
              <h2 className="text-base font-semibold text-white">
                {filter === "unread"
                  ? "No unread notifications."
                  : filter === "read"
                    ? "No read notifications yet."
                    : "No notifications yet."}
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-600">
                Alerts from payouts, support, and your portfolio show here.
              </p>
              <Link
                href="/dashboard"
                className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-yellow-500 hover:text-yellow-400"
              >
                <ArrowLeft size={14} aria-hidden />
                Back to dashboard
              </Link>
            </div>
          )}
        </div>

        <p className="mt-6 text-xs text-zinc-600">
          Unread rows mark as read when opened. Use Mark all read to clear the
          badge quickly.
        </p>
      </div>
    </div>
  );
}
