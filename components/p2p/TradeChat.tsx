"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";

export type ChatMessageKind = "user" | "system";

export type ChatMessage = {
  id: string;
  kind?: ChatMessageKind;
  /** For `system` rows: default = statement, success = milestones */
  systemTone?: "default" | "success";
  hideTime?: boolean;
  /** true = current user (right), false = counterparty (left); ignored for system */
  mine: boolean;
  body: string;
  at: Date;
};

type TradeChatProps = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Fills parent flex column (trade shell right pane); removes outer card chrome */
  embedded?: boolean;
};

export function TradeChat({
  messages,
  onSend,
  placeholder = "Type a message…",
  disabled,
  embedded,
}: TradeChatProps) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit() {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  }

  const userMessages = messages.filter((m) => (m.kind ?? "user") === "user");
  const root =
    embedded === true
      ? "flex min-h-0 flex-1 flex-col bg-transparent"
      : "mx-4 flex min-h-[280px] flex-col rounded-2xl border border-white/[0.06] bg-black/25 shadow-inner backdrop-blur-sm sm:mx-5";

  return (
    <section className={root}>
      <div
        className={`shrink-0 ${embedded ? "border-b border-white/[0.05] px-4 py-2 sm:px-5" : "border-b border-white/[0.06] bg-black/[0.06] px-4 py-3 sm:px-5"}`}
      >
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]/75">
          Trade chat
        </h2>
        <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-600">
          Same thread shown to both parties — stay on script with the escrow actions below.
        </p>
      </div>

      <div
        className={`min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5 ${embedded ? "" : "sm:max-h-[360px]"}`}
      >
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-600">
            No messages yet. Say hello and confirm payment details.
          </p>
        ) : (
          messages.map((m) => {
            const kind = m.kind ?? "user";
            if (kind === "system") {
              const success = m.systemTone === "success";
              return (
                <div key={m.id} className="flex w-full justify-stretch px-1 sm:px-2">
                  <div
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-left text-[12.5px] leading-snug ${
                      success
                        ? "border-emerald-500/22 bg-emerald-500/[0.07] text-emerald-50/95 shadow-[inset_0_1px_0_0_rgba(212,175,55,0.05)]"
                        : "border-white/[0.07] bg-white/[0.025] text-zinc-100/95 backdrop-blur-[3px]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap font-medium tracking-tight">{m.body}</p>
                    {!m.hideTime ? (
                      <p
                        className={`mt-1.5 text-[10px] tabular-nums ${
                          success ? "text-emerald-300/70" : "text-zinc-600"
                        }`}
                      >
                        {m.at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            }
            return (
              <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[70%] ${
                    m.mine
                      ? "rounded-br-md bg-emerald-600/[0.88] text-white ring-1 ring-[#D4AF37]/25 shadow-lg shadow-black/25"
                      : "rounded-bl-md border border-white/[0.06] bg-zinc-900/40 text-zinc-100 backdrop-blur-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p
                    className={`mt-1 text-[10px] tabular-nums ${
                      m.mine ? "text-emerald-200/85" : "text-zinc-500"
                    }`}
                  >
                    {m.at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        {messages.length > 0 && userMessages.length === 0 ? (
          <p className="pb-2 text-center text-[11px] text-zinc-600">No replies yet — add a note below.</p>
        ) : null}
        <div ref={endRef} />
      </div>

      <div
        className={`border-t border-white/[0.05] px-3 py-2.5 backdrop-blur-sm ${embedded ? "bg-transparent" : "bg-black/[0.12]"}`}
      >
        <div className="flex gap-2">
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-black/25 text-zinc-500 transition hover:border-white/15 hover:text-zinc-300 disabled:opacity-40"
            aria-label="Attach file"
            disabled={disabled}
            onClick={() => {
              /* UI only — attachments not wired */
            }}
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="min-w-0 flex-1 rounded-xl border border-white/[0.06] bg-black/30 px-4 py-2 text-sm text-white outline-none backdrop-blur-sm placeholder:text-zinc-600 focus:border-[#D4AF37]/35 focus:ring-1 focus:ring-[#D4AF37]/10 disabled:opacity-50"
          />
          <button
            type="button"
            disabled={disabled || !text.trim()}
            onClick={submit}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600/90 text-white shadow-inner shadow-black/40 ring-1 ring-[#D4AF37]/25 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
