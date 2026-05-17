"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSupabase, formatSupabaseError } from "@/lib/supabase";
import { ArrowLeft, Send, MessageCircle } from "lucide-react";

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
    <div className="min-h-screen text-white p-6 lg:p-10">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-5xl font-bold text-yellow-500 mb-2">
              Support Center
            </h1>

            <p className="text-gray-500">
              Contact support and manage your tickets.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="flex items-center gap-2 border border-zinc-800 hover:border-yellow-500 transition px-5 py-3 rounded-2xl"
          >
            <ArrowLeft size={18} />
            Dashboard
          </Link>
        </div>

        {ticketError ? (
          <div
            className="mb-6 rounded-xl border border-red-500/60 bg-red-500/10 px-5 py-4 text-red-300 text-sm"
            role="alert"
          >
            {ticketError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* CREATE TICKET */}
          <div className="bg-zinc-950/70 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 h-fit">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-yellow-500/10 p-3 rounded-2xl">
                <MessageCircle className="text-yellow-500" />
              </div>

              <div>
                <h2 className="text-2xl font-bold">
                  New Ticket
                </h2>

                <p className="text-gray-500 text-sm">
                  Submit a support request
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
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
                  className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-4 outline-none focus:border-yellow-500 transition text-white"
                >
                  {SUBJECT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="bg-zinc-950">
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {subjectCategory === OTHER_SUBJECT ? (
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">
                    Subject detail
                  </label>

                  <input
                    value={otherSubjectDetail}
                    onChange={(e) => setOtherSubjectDetail(e.target.value)}
                    placeholder="Briefly describe your topic…"
                    maxLength={OTHER_DETAIL_MAX_LEN}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-4 outline-none focus:border-yellow-500 transition"
                  />
                </div>
              ) : null}

              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  Message
                </label>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue..."
                  rows={6}
                  className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-4 outline-none focus:border-yellow-500 transition resize-none"
                />
              </div>

              <button
                onClick={createTicket}
                disabled={loading}
                className="w-full bg-yellow-500 hover:bg-yellow-600 transition text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2"
              >
                <Send size={18} />
                {loading ? "Submitting..." : "Submit Ticket"}
              </button>
            </div>
          </div>

          {/* SUPPORT LAYOUT */}
          <div className="xl:col-span-2 grid grid-cols-1 lg:grid-cols-[340px_1fr] bg-zinc-950/70 backdrop-blur-xl border border-zinc-800 rounded-3xl overflow-hidden min-h-[760px]">

            {/* SIDEBAR */}
            <div className="border-r border-zinc-800 overflow-y-auto">
              <div className="p-5 border-b border-zinc-800">
                <h2 className="text-2xl font-bold">
                  Your Tickets
                </h2>

                <p className="text-gray-500 text-sm mt-1">
                  Select a conversation
                </p>
              </div>

              {tickets.length > 0 ? (
                tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => {
                      setSelectedTicket(ticket);
                      fetchReplies(ticket.id);
                    }}
                    className={`w-full text-left p-5 border-b border-zinc-800 transition ${
                      selectedTicket?.id === ticket.id
                        ? "bg-yellow-500/10"
                        : "hover:bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-semibold text-lg mb-1">
                          {ticket.subject}
                        </h3>

                        <p className="text-gray-500 text-xs">
                          {new Date(ticket.created_at).toLocaleString()}
                        </p>
                      </div>

                      <div
                        className={`px-3 py-1 rounded-xl text-xs font-semibold ${
                          ticket.status === "open"
                            ? "bg-yellow-500/10 text-yellow-500"
                            : "bg-green-500/10 text-green-500"
                        }`}
                      >
                        {ticket.status}
                      </div>
                    </div>

                    <p className="text-sm text-gray-400 line-clamp-2">
                      {ticket.message}
                    </p>
                  </button>
                ))
              ) : (
                <div className="p-10 text-center text-gray-500">
                  No support tickets yet.
                </div>
              )}
            </div>

            {/* CHAT AREA */}
            <div className="flex flex-col h-full">

              {selectedTicket ? (
                <>
                  {/* CHAT HEADER */}
                  <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">
                        {selectedTicket.subject}
                      </h2>

                      <p className="text-gray-500 text-sm mt-1">
                        Ticket conversation
                      </p>
                    </div>

                    <div
                      className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                        selectedTicket.status === "open"
                          ? "bg-yellow-500/10 text-yellow-500"
                          : "bg-green-500/10 text-green-500"
                      }`}
                    >
                      {selectedTicket.status}
                    </div>
                  </div>

                  {/* MESSAGES */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-5">

                    {/* ORIGINAL MESSAGE */}
                    <div className="flex justify-end">
                      <div className="max-w-[75%] bg-zinc-900 border border-zinc-800 rounded-3xl px-5 py-4">
                        <div className="flex items-center justify-between mb-2 gap-5">
                          <p className="font-semibold">
                            You
                          </p>

                          <p className="text-xs text-gray-500">
                            {new Date(selectedTicket.created_at).toLocaleString()}
                          </p>
                        </div>

                        <p className="text-gray-300">
                          {selectedTicket.message}
                        </p>
                      </div>
                    </div>

                    {/* REPLIES */}
                    {replies.map((reply) => (
                      <div
                        key={reply.id}
                        className={`flex ${
                          reply.sender === "admin"
                            ? "justify-start"
                            : "justify-end"
                        }`}
                      >
                        <div
                          className={`max-w-[75%] rounded-3xl px-5 py-4 ${
                            reply.sender === "admin"
                              ? "bg-yellow-500 text-black"
                              : "bg-zinc-900 border border-zinc-800"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-5 mb-2">
                            <p className="font-semibold">
                              {reply.sender === "admin"
                                ? "Support Team"
                                : "You"}
                            </p>

                            <p
                              className={`text-xs ${
                                reply.sender === "admin"
                                  ? "text-black/70"
                                  : "text-gray-500"
                              }`}
                            >
                              {new Date(reply.created_at).toLocaleString()}
                            </p>
                          </div>

                          <p>
                            {reply.message}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* REPLY BOX */}
                  {selectedTicket.status === "open" && (
                    <div className="p-5 border-t border-zinc-800 flex gap-4">
                      <input
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 bg-black border border-zinc-800 rounded-2xl px-5 py-4 outline-none focus:border-yellow-500 transition"
                      />

                      <button
                        onClick={sendReply}
                        className="bg-yellow-500 hover:bg-yellow-600 transition text-black font-bold px-7 rounded-2xl"
                      >
                        Send
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  Select a ticket to open conversation.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
