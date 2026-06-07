"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, MessageCircle, Send } from "lucide-react";

import { DASHBOARD_CARD, DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";
import { useSupabase, formatSupabaseError } from "@/lib/supabase";

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

interface Reply {
  id: string;
  sender: string;
  message: string;
  created_at: string;
}

const SUBJECT_OPTIONS = [
  "Account issues",
  "Deposits",
  "Withdrawals",
  "Profits",
  "Other",
] as const;

type SubjectOption = (typeof SUBJECT_OPTIONS)[number];

const OTHER_SUBJECT: SubjectOption = "Other";

const OTHER_DETAIL_MAX_LEN = 200;

const fieldClass =
  "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#D4AF37]/40 focus:ring-1 focus:ring-[#D4AF37]/20";

function buildTicketSubject(
  category: SubjectOption,
  otherDetail: string,
): string {
  if (category === OTHER_SUBJECT) {
    return `${OTHER_SUBJECT}: ${otherDetail.trim()}`;
  }
  return category;
}

export default function SupportPage() {
  const supabase = useSupabase();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);

  const [subjectCategory, setSubjectCategory] = useState<SubjectOption>(
    SUBJECT_OPTIONS[0],
  );
  const [otherSubjectDetail, setOtherSubjectDetail] = useState("");
  const [message, setMessage] = useState("");
  const [replyMessage, setReplyMessage] = useState("");

  const [loading, setLoading] = useState(false);

  const [investorEmail, setInvestorEmail] = useState<string | null>(null);

  const [ticketError, setTicketError] = useState<string | null>(null);

  async function fetchReplies(
    ticketId: string,
    isCancelled?: () => boolean,
  ) {
    const { data, error } = await supabase
      .from("ticket_replies")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (isCancelled?.()) return;

    if (error) {
      setTicketError(formatSupabaseError(error));
      return;
    }

    setReplies(data || []);
  }

  async function loadTicketsForEmail(
    email: string,
    isCancelled?: () => boolean,
  ) {
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("investor_email", email)
      .neq("status", "closed")
      .order("created_at", { ascending: false });

    if (isCancelled?.()) return;

    if (error) {
      setTicketError(formatSupabaseError(error));
      return;
    }

    setTickets(data || []);

    if (data && data.length > 0) {
      setSelectedTicket(data[0]);
      await fetchReplies(data[0].id, isCancelled);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = user?.email;
      if (!email) return;

      setInvestorEmail(email);
      await loadTicketsForEmail(email, isCancelled);
    }

    void init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load; `useSupabase` client is memoized per mount
  }, [supabase]);

  async function createTicket() {
    const trimmedMessage = message.trim();
    const subject = buildTicketSubject(subjectCategory, otherSubjectDetail);

    if (subjectCategory === OTHER_SUBJECT && !otherSubjectDetail.trim()) {
      setTicketError("Please add a brief subject for Other.");
      return;
    }

    if (!trimmedMessage) {
      setTicketError("Please enter a message.");
      return;
    }

    if (!investorEmail) {
      setTicketError("You must be signed in to create a ticket.");
      return;
    }

    setTicketError(null);
    setLoading(true);

    const { error } = await supabase
      .from("support_tickets")
      .insert([
        {
          investor_email: investorEmail,
          subject,
          message: trimmedMessage,
          status: "open",
        },
      ]);

    setLoading(false);

    if (error) {
      setTicketError(formatSupabaseError(error));
      return;
    }

    setSubjectCategory(SUBJECT_OPTIONS[0]);
    setOtherSubjectDetail("");
    setMessage("");

    if (investorEmail) {
      void loadTicketsForEmail(investorEmail);
    }
  }

  async function sendReply() {
    if (!replyMessage || !selectedTicket) return;

    setTicketError(null);

    const { error } = await supabase
      .from("ticket_replies")
      .insert([
        {
          ticket_id: selectedTicket.id,
          sender: "user",
          message: replyMessage,
        },
      ]);

    if (error) {
      setTicketError(formatSupabaseError(error));
      return;
    }

    setReplyMessage("");

    fetchReplies(selectedTicket.id);
  }

  return (
    <div className="relative min-h-full bg-[#05070D] text-white">
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
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-[#D4AF37]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Dashboard
          </Link>

          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
              Help
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
              Support center
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
              Open tickets and message the team — same layout as your dashboard inbox.
            </p>
          </div>
        </motion.header>

        {ticketError ? (
          <div
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            role="alert"
          >
            {ticketError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-4">
          {/* CREATE TICKET */}
          <div className={`${DASHBOARD_CARD} h-fit p-4 sm:p-5`}>
            <div className="mb-4 border-b border-white/[0.06] pb-3">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
                New ticket
              </h2>
              <p className="mt-1 text-xs" style={{ color: DASHBOARD_MUTED }}>
                Choose a topic and describe your issue.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium" style={{ color: DASHBOARD_MUTED }}>
                  Subject
                </label>

                <select
                  value={subjectCategory}
                  onChange={(e) => {
                    const next = e.target.value as SubjectOption;
                    setSubjectCategory(next);
                    if (next !== OTHER_SUBJECT) {
                      setOtherSubjectDetail("");
                    }
                  }}
                  className={fieldClass}
                >
                  {SUBJECT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="bg-[#0A0F18]">
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {subjectCategory === OTHER_SUBJECT ? (
                <div>
                  <label className="mb-1 block text-[11px] font-medium" style={{ color: DASHBOARD_MUTED }}>
                    Subject detail
                  </label>

                  <input
                    value={otherSubjectDetail}
                    onChange={(e) => setOtherSubjectDetail(e.target.value)}
                    placeholder="Briefly describe your topic…"
                    maxLength={OTHER_DETAIL_MAX_LEN}
                    className={fieldClass}
                  />
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-[11px] font-medium" style={{ color: DASHBOARD_MUTED }}>
                  Message
                </label>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue…"
                  rows={6}
                  className={`${fieldClass} resize-none`}
                />
              </div>

              <button
                type="button"
                onClick={createTicket}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F7E3A0] via-[#D4AF37] to-[#EAC54F] px-4 py-2.5 text-xs font-bold text-black shadow-[0_0_20px_rgba(212,175,55,0.2)] transition hover:brightness-105 disabled:opacity-50"
              >
                <Send size={16} aria-hidden />
                {loading ? "Submitting…" : "Submit ticket"}
              </button>
            </div>
          </div>

          {/* TICKETS + THREAD */}
          <div
            className={`${DASHBOARD_CARD} grid min-h-[min(720px,85vh)] grid-cols-1 overflow-hidden lg:min-h-[760px] xl:col-span-2 lg:grid-cols-[minmax(260px,320px)_1fr]`}
          >
            {/* SIDEBAR */}
            <div className="max-h-[280px] overflow-y-auto border-b border-white/[0.06] lg:max-h-none lg:border-b-0 lg:border-r lg:border-white/[0.06]">
              <div className="border-b border-white/[0.06] px-4 py-3 sm:px-5">
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
                  Your tickets
                </h2>
                <p className="mt-0.5 text-xs" style={{ color: DASHBOARD_MUTED }}>
                  Select a thread
                </p>
              </div>

              {tickets.length > 0 ? (
                <div className="divide-y divide-white/[0.04]">
                  {tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => {
                        setSelectedTicket(ticket);
                        fetchReplies(ticket.id);
                      }}
                      className={`w-full px-4 py-3 text-left transition hover:bg-white/[0.02] sm:px-5 ${
                        selectedTicket?.id === ticket.id ? "bg-[#D4AF37]/[0.06]" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white">
                          {ticket.subject}
                        </h3>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            ticket.status === "open"
                              ? "bg-[#D4AF37]/15 text-[#D4AF37]"
                              : "bg-[#00C076]/15 text-[#00C076]"
                          }`}
                        >
                          {ticket.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] tabular-nums" style={{ color: DASHBOARD_MUTED }}>
                        {new Date(ticket.created_at).toLocaleString()}
                      </p>
                      <p className="mt-2 line-clamp-2 text-xs" style={{ color: DASHBOARD_MUTED }}>
                        {ticket.message}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-10 text-center text-sm sm:px-5" style={{ color: DASHBOARD_MUTED }}>
                  No support tickets yet.
                </div>
              )}
            </div>

            {/* THREAD */}
            <div className="flex min-h-[320px] flex-col lg:min-h-0">
              {selectedTicket ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-white sm:text-base">
                        {selectedTicket.subject}
                      </h2>
                      <p className="mt-0.5 text-xs" style={{ color: DASHBOARD_MUTED }}>
                        Ticket conversation
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        selectedTicket.status === "open"
                          ? "bg-[#D4AF37]/15 text-[#D4AF37]"
                          : "bg-[#00C076]/15 text-[#00C076]"
                      }`}
                    >
                      {selectedTicket.status}
                    </span>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 sm:max-w-[75%]">
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-white">You</p>
                          <p className="text-[11px] tabular-nums" style={{ color: DASHBOARD_MUTED }}>
                            {new Date(selectedTicket.created_at).toLocaleString()}
                          </p>
                        </div>
                        <p className="text-sm leading-relaxed text-zinc-300">
                          {selectedTicket.message}
                        </p>
                      </div>
                    </div>

                    {replies.map((reply) => (
                      <div
                        key={reply.id}
                        className={`flex ${
                          reply.sender === "admin" ? "justify-start" : "justify-end"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-xl px-3 py-2.5 sm:max-w-[75%] ${
                            reply.sender === "admin"
                              ? "border border-[#D4AF37]/30 bg-[#D4AF37]/15 text-[#F5E6B3]"
                              : "border border-white/[0.08] bg-white/[0.03] text-zinc-200"
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold">
                              {reply.sender === "admin" ? "Support" : "You"}
                            </p>
                            <p
                              className={`text-[11px] tabular-nums ${
                                reply.sender === "admin" ? "text-[#D4AF37]/70" : ""
                              }`}
                              style={
                                reply.sender === "admin" ? undefined : { color: DASHBOARD_MUTED }
                              }
                            >
                              {new Date(reply.created_at).toLocaleString()}
                            </p>
                          </div>
                          <p className="text-sm leading-relaxed">{reply.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedTicket.status === "open" && (
                    <div className="flex gap-2 border-t border-white/[0.06] p-3 sm:p-4">
                      <input
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Type a message…"
                        className={`min-w-0 flex-1 ${fieldClass}`}
                      />

                      <button
                        type="button"
                        onClick={sendReply}
                        className="shrink-0 rounded-xl bg-gradient-to-r from-[#F7E3A0] via-[#D4AF37] to-[#EAC54F] px-4 py-2.5 text-xs font-bold text-black transition hover:brightness-105"
                      >
                        Send
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div
                  className="flex flex-1 items-center justify-center px-4 py-16 text-center text-sm"
                  style={{ color: DASHBOARD_MUTED }}
                >
                  <span className="inline-flex items-center gap-2">
                    <MessageCircle size={18} className="text-zinc-600" aria-hidden />
                    Select a ticket to view the conversation.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
