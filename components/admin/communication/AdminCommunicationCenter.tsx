"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Bell,
  Inbox,
  Mail,
  Megaphone,
  MessageSquare,
  Plus,
  Search,
  Send,
  Star,
  Ticket,
} from "lucide-react";

import type {
  AdminNotificationRow,
  CommunicationFolder,
  EmailRow,
  EmailThreadRow,
  SupportTicketRow,
  TicketReplyRow,
} from "@/lib/adminCommunication/types";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

const folderItems: { id: CommunicationFolder; label: string; icon: typeof Inbox }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: Mail },
  { id: "tickets", label: "Support Tickets", icon: Ticket },
  { id: "archived", label: "Archived", icon: Archive },
  { id: "notifications", label: "Notifications", icon: Bell },
];

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminCommunicationCenter() {
  const supabase = useSupabase();
  const [folder, setFolder] = useState<CommunicationFolder>("inbox");
  const [search, setSearch] = useState("");
  const [threads, setThreads] = useState<EmailThreadRow[]>([]);
  const [drafts, setDrafts] = useState<EmailRow[]>([]);
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [notifications, setNotifications] = useState<AdminNotificationRow[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<EmailRow[]>([]);
  const [ticketReplies, setTicketReplies] = useState<TicketReplyRow[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId],
  );

  const loadFolder = useCallback(async () => {
    setError(null);
    if (folder === "notifications") {
      const { data } = await supabase
        .from("admin_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setNotifications((data as AdminNotificationRow[]) ?? []);
      return;
    }

    if (folder === "tickets") {
      const { data } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setTickets((data as SupportTicketRow[]) ?? []);
      return;
    }

    if (folder === "drafts") {
      const { data, error: e } = await supabase.rpc("admin_list_email_drafts");
      if (e) {
        setError(formatSupabaseError(e));
        return;
      }
      setDrafts((data as EmailRow[]) ?? []);
      return;
    }

    const rpcFolder = folder === "sent" ? "inbox" : folder;
    const { data, error: e } = await supabase.rpc("admin_list_email_threads", {
      p_folder: rpcFolder,
      p_search: search.trim() || null,
    });

    if (e) {
      setError(formatSupabaseError(e));
      return;
    }

    let rows = (data as EmailThreadRow[]) ?? [];

    if (folder === "sent") {
      const { data: sentEmails } = await supabase
        .from("emails")
        .select("thread_id")
        .eq("direction", "outbound")
        .neq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(200);

      const sentThreadIds = new Set(
        (sentEmails ?? []).map((r: { thread_id: string }) => r.thread_id),
      );
      rows = rows.filter((t) => sentThreadIds.has(t.id));
    }

    setThreads(rows);
  }, [folder, search, supabase]);

  const loadThreadMessages = useCallback(
    async (threadId: string) => {
      const { data, error: e } = await supabase.rpc("admin_get_email_thread_messages", {
        p_thread_id: threadId,
      });
      if (e) {
        setError(formatSupabaseError(e));
        return;
      }
      setMessages((data as EmailRow[]) ?? []);
      await supabase.rpc("admin_mark_email_thread_read", { p_thread_id: threadId });
    },
    [supabase],
  );

  const loadTicketReplies = useCallback(
    async (ticketId: string) => {
      const { data } = await supabase
        .from("ticket_replies")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      setTicketReplies((data as TicketReplyRow[]) ?? []);
    },
    [supabase],
  );

  useEffect(() => {
    void loadFolder();
  }, [loadFolder]);

  useEffect(() => {
    const reload = () => void loadFolder();
    window.addEventListener("tp:admin-notification", reload);
    return () => window.removeEventListener("tp:admin-notification", reload);
  }, [loadFolder]);

  useEffect(() => {
    if (selectedThreadId) void loadThreadMessages(selectedThreadId);
  }, [selectedThreadId, loadThreadMessages]);

  useEffect(() => {
    if (selectedTicketId) void loadTicketReplies(selectedTicketId);
  }, [selectedTicketId, loadTicketReplies]);

  async function handleSendEmail(opts?: {
    to?: string;
    subject?: string;
    body?: string;
    threadId?: string | null;
    saveDraft?: boolean;
  }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/communication/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          threadId: opts?.threadId ?? selectedThreadId,
          to: opts?.to ?? composeTo,
          subject: opts?.subject ?? composeSubject,
          body: opts?.body ?? composeBody,
          saveDraft: opts?.saveDraft ?? false,
        }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(json.error ?? "Failed to send");
        return;
      }
      setComposeOpen(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      setReplyBody("");
      await loadFolder();
      if (selectedThreadId) await loadThreadMessages(selectedThreadId);
    } finally {
      setBusy(false);
    }
  }

  async function handleTicketReply() {
    if (!selectedTicket || !replyBody.trim()) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.from("ticket_replies").insert([
      {
        ticket_id: selectedTicket.id,
        sender: "admin",
        message: replyBody.trim(),
      },
    ]);
    setBusy(false);
    if (e) {
      setError(formatSupabaseError(e));
      return;
    }
    setReplyBody("");
    await loadTicketReplies(selectedTicket.id);
  }

  async function toggleStar(threadId: string, starred: boolean) {
    await supabase.rpc("admin_set_email_thread_starred", {
      p_thread_id: threadId,
      p_starred: !starred,
    });
    await loadFolder();
  }

  async function archiveThread(threadId: string) {
    await supabase.rpc("admin_archive_email_thread", { p_thread_id: threadId });
    setSelectedThreadId(null);
    await loadFolder();
  }

  async function markNotificationRead(id: string) {
    await supabase.rpc("admin_mark_notifications_read", { p_ids: [id] });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[560px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#F5E6B3]">Communication Center</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Support inbox, platform alerts, tickets, and announcements — all in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/promotions"
            className="inline-flex items-center gap-2 rounded-xl border border-[#D4AF37]/30 px-3 py-2 text-xs font-semibold text-[#F5E6B3] hover:bg-[#D4AF37]/10"
          >
            <Megaphone className="h-4 w-4" />
            Announcements
          </Link>
          <button
            type="button"
            onClick={() => {
              setComposeOpen(true);
              setSelectedThreadId(null);
              setSelectedTicketId(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37]/20 px-3 py-2 text-xs font-semibold text-[#F5E6B3] ring-1 ring-[#D4AF37]/40"
          >
            <Plus className="h-4 w-4" />
            Compose
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0A0F18]/80 lg:grid-cols-[200px_280px_1fr]">
        {/* Left sidebar */}
        <aside className="border-b border-white/10 p-3 lg:border-b-0 lg:border-r">
          <nav className="flex flex-col gap-1">
            {folderItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setFolder(id);
                  setSelectedThreadId(null);
                  setSelectedTicketId(null);
                  setComposeOpen(false);
                }}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  folder === id
                    ? "bg-[#D4AF37]/15 text-[#F5E6B3]"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Center list */}
        <section className="flex min-h-0 flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
          {folder !== "notifications" && folder !== "tickets" && folder !== "drafts" ? (
            <div className="border-b border-white/10 p-2">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                <Search className="h-4 w-4 text-zinc-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search emails…"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                />
              </div>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {folder === "notifications"
              ? notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void markNotificationRead(n.id)}
                    className={`block w-full border-b border-white/5 px-3 py-3 text-left transition hover:bg-white/5 ${
                      !n.is_read ? "bg-[#D4AF37]/5" : ""
                    }`}
                  >
                    <p className="text-sm font-semibold text-[#F5E6B3]">{n.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{n.message}</p>
                    <p className="mt-1 text-[10px] text-zinc-600">{formatWhen(n.created_at)}</p>
                    {n.action_link ? (
                      <Link
                        href={n.action_link}
                        className="mt-1 inline-block text-[11px] text-[#D4AF37]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View →
                      </Link>
                    ) : null}
                  </button>
                ))
              : null}

            {folder === "tickets"
              ? tickets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTicketId(t.id);
                      setSelectedThreadId(null);
                      setComposeOpen(false);
                    }}
                    className={`block w-full border-b border-white/5 px-3 py-3 text-left transition hover:bg-white/5 ${
                      selectedTicketId === t.id ? "bg-[#D4AF37]/10" : ""
                    }`}
                  >
                    <p className="text-sm font-semibold text-[#F5E6B3]">{t.subject}</p>
                    <p className="text-xs text-zinc-500">{t.investor_email}</p>
                    <p className="mt-1 text-[10px] uppercase text-zinc-600">{t.status}</p>
                  </button>
                ))
              : null}

            {folder === "drafts"
              ? drafts.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setComposeOpen(true);
                      setComposeTo(d.recipient_email);
                      setComposeSubject(d.subject);
                      setComposeBody(d.body_text ?? "");
                      setSelectedThreadId(d.thread_id);
                    }}
                    className="block w-full border-b border-white/5 px-3 py-3 text-left hover:bg-white/5"
                  >
                    <p className="text-sm font-semibold text-[#F5E6B3]">{d.subject || "(no subject)"}</p>
                    <p className="text-xs text-zinc-500">To: {d.recipient_email}</p>
                  </button>
                ))
              : null}

            {folder !== "notifications" && folder !== "tickets" && folder !== "drafts"
              ? threads.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedThreadId(t.id);
                      setSelectedTicketId(null);
                      setComposeOpen(false);
                      setComposeTo(t.customer_email);
                      setComposeSubject(t.subject.startsWith("Re:") ? t.subject : `Re: ${t.subject}`);
                    }}
                    className={`block w-full border-b border-white/5 px-3 py-3 text-left transition hover:bg-white/5 ${
                      selectedThreadId === t.id ? "bg-[#D4AF37]/10" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[#F5E6B3]">
                        {t.is_starred ? "★ " : ""}
                        {t.customer_email}
                      </p>
                      {(t.unread_count ?? 0) > 0 ? (
                        <span className="rounded-full bg-[#D4AF37] px-1.5 text-[10px] font-bold text-black">
                          {t.unread_count}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-300">{t.subject}</p>
                    <p className="mt-1 line-clamp-1 text-[11px] text-zinc-500">{t.last_preview}</p>
                    <p className="mt-1 text-[10px] text-zinc-600">{formatWhen(t.last_message_at)}</p>
                  </button>
                ))
              : null}
          </div>
        </section>

        {/* Right panel */}
        <section className="flex min-h-0 flex-col">
          {composeOpen ? (
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <h2 className="mb-3 text-lg font-semibold text-[#F5E6B3]">Compose email</h2>
              <input
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="To"
                className="mb-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
              <input
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Subject"
                className="mb-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                rows={12}
                placeholder="Message…"
                className="mb-3 min-h-0 flex-1 resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSendEmail()}
                  className="rounded-xl bg-[#D4AF37]/25 px-4 py-2 text-sm font-semibold text-[#F5E6B3] disabled:opacity-50"
                >
                  Send
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSendEmail({ saveDraft: true })}
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm text-zinc-300"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  onClick={() => setComposeOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm text-zinc-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : selectedTicket ? (
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <h2 className="text-lg font-semibold text-[#F5E6B3]">{selectedTicket.subject}</h2>
              <p className="text-sm text-zinc-500">{selectedTicket.investor_email}</p>
              <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <p className="text-[10px] uppercase text-zinc-600">Customer</p>
                  <p className="mt-1 text-sm text-zinc-200">{selectedTicket.message}</p>
                </div>
                {ticketReplies.map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-xl border p-3 ${
                      r.sender === "admin"
                        ? "border-[#D4AF37]/25 bg-[#D4AF37]/5"
                        : "border-white/10 bg-black/25"
                    }`}
                  >
                    <p className="text-[10px] uppercase text-zinc-600">{r.sender}</p>
                    <p className="mt-1 text-sm text-zinc-200">{r.message}</p>
                    <p className="mt-1 text-[10px] text-zinc-600">{formatWhen(r.created_at)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-white/10 pt-3">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={3}
                  placeholder="Reply to ticket…"
                  className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                />
                <button
                  type="button"
                  disabled={busy || !replyBody.trim()}
                  onClick={() => void handleTicketReply()}
                  className="mt-2 rounded-xl bg-[#D4AF37]/25 px-4 py-2 text-sm font-semibold text-[#F5E6B3] disabled:opacity-50"
                >
                  Send reply
                </button>
              </div>
            </div>
          ) : selectedThread ? (
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-[#F5E6B3]">{selectedThread.subject}</h2>
                  <p className="text-sm text-zinc-500">{selectedThread.customer_email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleStar(selectedThread.id, selectedThread.is_starred)}
                    className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:text-[#F5E6B3]"
                    title="Star"
                  >
                    <Star className={`h-4 w-4 ${selectedThread.is_starred ? "fill-[#D4AF37] text-[#D4AF37]" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void archiveThread(selectedThread.id)}
                    className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:text-[#F5E6B3]"
                    title="Archive"
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl border p-3 ${
                      m.direction === "outbound"
                        ? "border-[#D4AF37]/25 bg-[#D4AF37]/5"
                        : "border-white/10 bg-black/25"
                    }`}
                  >
                    <div className="flex justify-between gap-2 text-[10px] uppercase text-zinc-600">
                      <span>{m.direction === "outbound" ? "Zuno Support" : m.sender_email}</span>
                      <span>{formatWhen(m.sent_at ?? m.created_at)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-200">
                      {m.body_text ?? ""}
                    </p>
                    {Array.isArray(m.attachments) && m.attachments.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-[#D4AF37]">
                        {(m.attachments as Array<{ name?: string; url?: string }>).map((a, i) => (
                          <li key={i}>
                            {a.url ? (
                              <a href={a.url} target="_blank" rel="noreferrer">
                                {a.name ?? "attachment"}
                              </a>
                            ) : (
                              a.name ?? "attachment"
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-white/10 pt-3">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={4}
                  placeholder="Reply…"
                  className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                />
                <button
                  type="button"
                  disabled={busy || !replyBody.trim()}
                  onClick={() =>
                    void handleSendEmail({
                      to: selectedThread.customer_email,
                      subject: selectedThread.subject.startsWith("Re:")
                        ? selectedThread.subject
                        : `Re: ${selectedThread.subject}`,
                      body: replyBody,
                      threadId: selectedThread.id,
                    })
                  }
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#D4AF37]/25 px-4 py-2 text-sm font-semibold text-[#F5E6B3] disabled:opacity-50"
                >
                  <MessageSquare className="h-4 w-4" />
                  Reply
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-zinc-500">
              <Mail className="mb-3 h-10 w-10 text-zinc-700" />
              <p className="text-sm">Select a conversation or compose a new email.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
