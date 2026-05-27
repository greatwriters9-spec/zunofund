"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Paperclip, Send } from "lucide-react";

export type ChatMessageKind = "user" | "system";

export type ChatMessage = {
  id: string;
  kind?: ChatMessageKind;
  systemTone?: "default" | "success";
  hideTime?: boolean;
  mine: boolean;
  body: string;
  at: Date;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMimeType?: string | null;
};

type TradeChatProps = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onAttach?: (file: File) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Counterparty label shown in the chat bubbles' name strip */
  counterpartLabel?: string;
  /** Render dark-on-light styling (Noones-like) */
  light?: boolean;
};

export function TradeChat({
  messages,
  onSend,
  onAttach,
  placeholder = "Write a message…",
  disabled,
  counterpartLabel,
  light = true,
}: TradeChatProps) {
  const [text, setText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  if (!light) {
    return null;
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-[#05080F]">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {messages.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">
              No messages yet. Say hello and confirm payment details.
            </p>
          ) : (
            messages.map((m) => {
              const kind = m.kind ?? "user";
              if (kind === "system") {
                const success = m.systemTone === "success";
                return (
                  <div key={m.id} className="my-1 w-full">
                    <div
                      className={`w-full rounded-md border px-4 py-3 text-[13px] leading-relaxed ${
                        success
                          ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-50"
                          : "border-[#D4AF37]/15 bg-black/40 text-zinc-300"
                      }`}
                    >
                      {success ? null : (
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#D4AF37]/85">
                          System message
                        </p>
                      )}
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      {!m.hideTime ? (
                        <p
                          className={`mt-1.5 text-[11px] tabular-nums ${
                            success ? "text-emerald-300/80" : "text-zinc-500"
                          }`}
                        >
                          {m.at.toLocaleDateString(undefined, {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}{" "}
                          ·{" "}
                          {m.at.toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              }
              return (
                <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[80%] sm:max-w-[68%]">
                    {!m.mine && counterpartLabel ? (
                      <p className="mb-0.5 px-1 text-[11px] font-medium text-[#D4AF37]/80">{counterpartLabel}</p>
                    ) : null}
                    <div
                      className={`px-3.5 py-2.5 text-[14px] leading-relaxed ${
                        m.mine
                          ? "rounded-[14px] rounded-br-[4px] bg-emerald-600 text-white ring-1 ring-[#D4AF37]/25"
                          : "rounded-[14px] rounded-bl-[4px] border border-[#D4AF37]/12 bg-black/45 text-zinc-100"
                      }`}
                    >
                      {m.attachmentUrl ? (
                        <a
                          href={m.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mb-2 block overflow-hidden rounded-lg border border-white/10 bg-black/25"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.attachmentUrl}
                            alt={m.attachmentName ?? "Payment screenshot"}
                            className="max-h-72 w-full object-contain"
                          />
                        </a>
                      ) : m.attachmentName ? (
                        <div className="mb-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs">
                          <ImageIcon size={14} aria-hidden />
                          <span className="break-all">{m.attachmentName}</span>
                        </div>
                      ) : null}
                      {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
                      <p
                        className={`mt-1 text-right text-[10.5px] tabular-nums ${
                          m.mine ? "text-emerald-50/80" : "text-zinc-500"
                        }`}
                      >
                        {m.at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} className="h-1 shrink-0" aria-hidden />
        </div>
      </div>

      <div className="shrink-0 border-t border-[#D4AF37]/12 bg-black/55 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onAttach?.(file);
            }}
          />
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#D4AF37]/20 bg-black/40 text-[#D4AF37] transition hover:border-[#D4AF37]/45 hover:text-[#F5E6B3] disabled:opacity-40"
            aria-label="Attach payment screenshot"
            disabled={disabled || !onAttach}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
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
            enterKeyHint="send"
            className="min-h-[44px] min-w-0 flex-1 rounded-md border border-[#D4AF37]/15 bg-black/45 px-4 py-2.5 text-[16px] text-white outline-none transition placeholder:text-zinc-500 focus:border-[#D4AF37]/45 focus:bg-black/55 focus:ring-2 focus:ring-[#D4AF37]/20 disabled:opacity-50 sm:text-[14px]"
          />
          <button
            type="button"
            disabled={disabled || !text.trim()}
            onClick={submit}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white ring-1 ring-[#D4AF37]/30 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
