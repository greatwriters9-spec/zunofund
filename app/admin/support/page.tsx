"use client";

import { useEffect, useState } from "react";

import {
  MessageCircle,
  Send,
  CheckCircle2,
  RotateCcw,
  Bell,
} from "lucide-react";

import { useSupabase, formatSupabaseError } from "@/lib/supabase";

interface Ticket {
  id: string;
  investor_email: string;
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

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  type?: string;
}

export default function AdminSupportPage() {
  const supabase = useSupabase();

  const [tickets, setTickets] = useState<Ticket[]>(
    []
  );

  const [selectedTicket, setSelectedTicket] =
    useState<Ticket | null>(null);

  const [replies, setReplies] = useState<Reply[]>(
    []
  );

  const [replyMessage, setReplyMessage] =
    useState("");

  const [loading, setLoading] = useState(true);

  const [notifications, setNotifications] =
    useState<AdminNotification[]>([]);

  const [replyError, setReplyError] = useState<string | null>(null);

  const [showNotifications, setShowNotifications] =
    useState(false);

  useEffect(() => {
    fetchTickets();
    fetchNotifications();

    const reload = () => {
      void fetchNotifications();
      void fetchTickets();
    };

    window.addEventListener("tp:admin-notification", reload);
    return () => {
      window.removeEventListener("tp:admin-notification", reload);
    };
  }, []);

  async function fetchTickets() {
    setLoading(true);

    const { data } = await supabase
      .from("support_tickets")
.select("*")
.neq("status", "closed")
.order("created_at", { ascending: false })

    setTickets(data || []);

    setLoading(false);
  }

  async function fetchNotifications() {
    const { data } = await supabase
      .from("admin_notifications")
      .select("*")
      .eq("is_read", false)
      .order("created_at", {
        ascending: false,
      });

    setNotifications(data || []);
  }

  async function markNotificationAsRead(
    id: string
  ) {
    await supabase
      .from("admin_notifications")
      .update({ is_read: true })
      .eq("id", id);

    setNotifications((prev) =>
      prev.filter(
        (notification) =>
          notification.id !== id
      )
    );
  }

  async function openTicket(ticket: Ticket) {
    setSelectedTicket(ticket);

    const { data } = await supabase
      .from("ticket_replies")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", {
        ascending: true,
      });

    setReplies(data || []);
  }

  async function sendReply() {
    if (!selectedTicket || !replyMessage) {
      return;
    }

    setReplyError(null);

    const { error } = await supabase
      .from("ticket_replies")
      .insert([
        {
          ticket_id: selectedTicket.id,
          sender: "admin",
          message: replyMessage,
        },
      ]);

    if (error) {
      setReplyError(formatSupabaseError(error));

      return;
    }

    const { data: inv } = await supabase
      .from("investors")
      .select("user_id")
      .eq("email", selectedTicket.investor_email)
      .maybeSingle();

    // CREATE USER NOTIFICATION
    await supabase.from("notifications").insert([
      {
        user_id: inv?.user_id ?? null,

        investor_email: selectedTicket.investor_email,

        title: "Support reply",

        message:
          replyMessage,

        type: "support_reply",
      },
    ]);

    setReplyMessage("");

    await openTicket(selectedTicket);
  }

  async function updateTicketStatus(
    status: string
  ) {
    if (!selectedTicket) return;

    await supabase
      .from("support_tickets")
      .update({ status })
      .eq("id", selectedTicket.id);

    const updatedTicket = {
      ...selectedTicket,
      status,
    };

    setSelectedTicket(updatedTicket);

    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === updatedTicket.id
          ? updatedTicket
          : ticket
      )
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">

      {/* Ambient */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-yellow-500/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-yellow-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 p-5 md:p-7 max-w-[1800px] mx-auto">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">

          <div>
            <h1 className="text-4xl font-bold text-yellow-500 mb-2">
              Support Management
            </h1>

            <p className="text-gray-400">
              Manage investor conversations and
              support tickets.
            </p>
          </div>

          {/* Notifications */}
          <div className="relative">

            <button
              onClick={() =>
                setShowNotifications(
                  !showNotifications
                )
              }
              className="relative bg-zinc-950 border border-zinc-800 hover:border-yellow-500 transition p-4 rounded-2xl"
            >
              <Bell
                className="text-yellow-500"
                size={24}
              />

              {notifications.length > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                  {notifications.length}
                </div>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-4 w-[360px] bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl z-50">

                <div className="p-5 border-b border-zinc-800">

                  <h2 className="text-xl font-bold">
                    Notifications
                  </h2>
                </div>

                <div className="max-h-[420px] overflow-y-auto">

                  {notifications.length > 0 ? (
                    notifications.map(
                      (notification) => (
                        <button
                          key={
                            notification.id
                          }
                          onClick={() =>
                            markNotificationAsRead(
                              notification.id
                            )
                          }
                          className="w-full text-left p-5 border-b border-zinc-800 hover:bg-zinc-900 transition"
                        >

                          <h3 className="font-semibold mb-2">
                            {
                              notification.title
                            }
                          </h3>

                          <p className="text-gray-400 text-sm mb-2">
                            {
                              notification.message
                            }
                          </p>

                          <p className="text-gray-600 text-xs">
                            {new Date(
                              notification.created_at
                            ).toLocaleString()}
                          </p>
                        </button>
                      )
                    )
                  ) : (
                    <div className="p-10 text-center text-gray-500">
                      No notifications.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">

          {/* LEFT PANEL */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden h-[85vh] flex flex-col">

            <div className="p-5 border-b border-zinc-800">

              <h2 className="text-2xl font-bold mb-1">
                Support Tickets
              </h2>

              <p className="text-gray-500 text-sm">
                Investor conversations
              </p>
            </div>

            <div className="flex-1 overflow-y-auto">

              {loading ? (
                <div className="p-10 text-center text-gray-500">
                  Loading tickets...
                </div>
              ) : tickets.length > 0 ? (
                tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() =>
                      openTicket(ticket)
                    }
                    className={`w-full text-left p-5 border-b border-zinc-800 hover:bg-zinc-900 transition ${
                      selectedTicket?.id ===
                      ticket.id
                        ? "bg-zinc-900"
                        : ""
                    }`}
                  >

                    <div className="flex items-center justify-between gap-3 mb-3">

                      <div>
                        <h3 className="font-semibold text-white line-clamp-1">
                          {ticket.subject}
                        </h3>

                        <p className="text-gray-500 text-xs mt-1">
                          {
                            ticket.investor_email
                          }
                        </p>
                      </div>

                      <div
                        className={`px-3 py-1 rounded-xl text-xs font-medium ${
                          ticket.status ===
                          "open"
                            ? "bg-yellow-500/10 text-yellow-500"
                            : "bg-green-500/10 text-green-500"
                        }`}
                      >
                        {ticket.status}
                      </div>
                    </div>

                    <p className="text-gray-400 text-sm line-clamp-2">
                      {ticket.message}
                    </p>

                    <p className="text-gray-600 text-xs mt-4">
                      {new Date(
                        ticket.created_at
                      ).toLocaleString()}
                    </p>
                  </button>
                ))
              ) : (
                <div className="p-10 text-center text-gray-500">
                  No support tickets yet.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl h-[85vh] flex flex-col overflow-hidden">

            {selectedTicket ? (
              <>
                {/* HEADER */}
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between gap-4">

                  <div>
                    <h2 className="text-2xl font-bold mb-1">
                      {selectedTicket.subject}
                    </h2>

                    <p className="text-gray-500">
                      {
                        selectedTicket.investor_email
                      }
                    </p>
                  </div>

                  <div className="flex items-center gap-3">

                    {selectedTicket.status ===
                    "open" ? (
                      <button
                        onClick={() =>
                          updateTicketStatus(
                            "closed"
                          )
                        }
                        className="flex items-center gap-2 bg-green-500 hover:bg-green-600 transition text-black font-semibold px-5 py-3 rounded-2xl"
                      >
                        <CheckCircle2
                          size={18}
                        />
                        Close
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          updateTicketStatus(
                            "open"
                          )
                        }
                        className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 transition text-black font-semibold px-5 py-3 rounded-2xl"
                      >
                        <RotateCcw
                          size={18}
                        />
                        Reopen
                      </button>
                    )}
                  </div>
                </div>

                {/* CONVERSATION */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                  {/* ORIGINAL MESSAGE */}
                  <div className="flex justify-start">

                    <div className="max-w-[80%] bg-black border border-zinc-800 rounded-3xl p-5">

                      <div className="mb-3">

                        <h3 className="font-semibold">
                          Investor
                        </h3>

                        <p className="text-gray-500 text-xs">
                          {new Date(
                            selectedTicket.created_at
                          ).toLocaleString()}
                        </p>
                      </div>

                      <p className="text-gray-300 leading-relaxed">
                        {
                          selectedTicket.message
                        }
                      </p>
                    </div>
                  </div>

                  {/* REPLIES */}
                  {replies.map((reply) => (
                    <div
                      key={reply.id}
                      className={`flex ${
                        reply.sender ===
                        "admin"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >

                      <div
                        className={`max-w-[80%] rounded-3xl p-5 ${
                          reply.sender ===
                          "admin"
                            ? "bg-yellow-500 text-black"
                            : "bg-black border border-zinc-800"
                        }`}
                      >

                        <div className="mb-3">

                          <h3 className="font-semibold">
                            {reply.sender ===
                            "admin"
                              ? "Support Team"
                              : "Investor"}
                          </h3>

                          <p
                            className={`text-xs ${
                              reply.sender ===
                              "admin"
                                ? "text-black/70"
                                : "text-gray-500"
                            }`}
                          >
                            {new Date(
                              reply.created_at
                            ).toLocaleString()}
                          </p>
                        </div>

                        <p
                          className={`leading-relaxed ${
                            reply.sender ===
                            "admin"
                              ? "text-black"
                              : "text-gray-300"
                          }`}
                        >
                          {reply.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* REPLY BOX */}
                <div className="p-6 border-t border-zinc-800">

                  {replyError ? (
                    <div className="mb-4 rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                      {replyError}
                    </div>
                  ) : null}

                  <div className="flex items-end gap-4">

                    <textarea
                      value={replyMessage}
                      onChange={(e) =>
                        setReplyMessage(
                          e.target.value
                        )
                      }
                      placeholder="Type your reply..."
                      rows={3}
                      className="flex-1 bg-black border border-zinc-800 rounded-2xl px-4 py-4 outline-none focus:border-yellow-500 transition resize-none"
                    />

                    <button
                      onClick={sendReply}
                      className="bg-yellow-500 hover:bg-yellow-600 transition text-black font-bold p-4 rounded-2xl"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                Select a support ticket to begin.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}