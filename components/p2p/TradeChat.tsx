"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Paperclip, Send } from "lucide-react";

import { DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";

export type ChatMessageKind = "user" | "system" | "automated";

export type ChatMessage = {
  id: string;
  kind?: ChatMessageKind;
  systemTone?: "default" | "success";
  hideTime?: boolean;
  mine: boolean;
  senderRole?: "party" | "admin";
  automatedLabel?: string;
  senderLabel?: string;
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
  counterpartLabel?: string;
  light?: boolean;
  /** Room for sticky action bar below composer on mobile */
  mobileActionBar?: boolean;
};

export function TradeChat({
  messages,
  onSend,
  onAttach,
  placeholder = "Write a message…",
  disabled,
  counterpartLabel,
  light = true,
  mobileActionBar = false,
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

  // Dock: 1.25rem bottom gap + ~4.5rem card + 1.25rem gap above dock + safe area
  const messagesPad = mobileActionBar
    ? "max-lg:pb-[calc(11rem+env(safe-area-inset-bottom))]"
    : "max-lg:pb-24";

  const composerCls = `shrink-0 border-t border-white/[0.06] bg-[rgba(8,12,20,0.72)] px-3 py-3 backdrop-blur-md max-lg:fixed max-lg:inset-x-0 max-lg:z-30 max-lg:border-white/[0.08] max-lg:bg-[rgba(8,12,20,0.92)] max-lg:py-2.5 max-lg:backdrop-blur-xl sm:px-6 lg:relative lg:bottom-auto lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
    mobileActionBar
      ? "max-lg:bottom-[calc(7rem+env(safe-area-inset-bottom))]"
      : "max-lg:bottom-0 max-lg:pb-[max(0.5rem,env(safe-area-inset-bottom))]"
  }`;

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-[#05070D]">
      <div
        className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 [scrollbar-width:thin] sm:px-5 sm:py-4 ${messagesPad}`}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
          {messages.length === 0 ? (
            <p className="py-6 text-center text-sm" style={{ color: DASHBOARD_MUTED }}>
              No messages yet. Say hello and confirm payment details.
            </p>
          ) : (
            messages.map((m) => {
              const kind = m.kind ?? "user";
              if (kind === "automated") {
                return (
                  <div key={m.id} className="flex justify-start">
                    <div className="max-w-[92%] sm:max-w-[78%]">
                      <p className="mb-0.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-[#D4AF37]/75">
                        {m.senderLabel ?? "Automated"}
                      </p>
                      <div className="rounded-2xl rounded-bl-md border border-[#D4AF37]/20 bg-[#D4AF37]/[0.07] px-3 py-2 text-[13px] leading-relaxed text-zinc-100">
                        {m.automatedLabel ? (
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#F5E6B3]">
                            {m.automatedLabel}
                          </p>
                        ) : null}
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      </div>
                    </div>
                  </div>
                );
              }
              if (kind === "system") {
                const success = m.systemTone === "success";
                return (
                  <div key={m.id} className="my-0.5 w-full">
                    <div
                      className={`w-full rounded-lg border px-3 py-1.5 text-[11.5px] leading-relaxed sm:text-[12px] ${
                        success
                          ? "border-[#00C076]/25 bg-[#00C076]/[0.08] text-emerald-50"
                          : "border-white/[0.06] bg-[rgba(12,17,28,0.55)] text-zinc-400"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                  </div>
                );
              }
              const isAdminMsg = m.senderRole === "admin";
              return (
                <div
                  key={m.id}
                  className={`flex ${
                    m.mine && !isAdminMsg ? "justify-end" : isAdminMsg ? "justify-center" : "justify-start"
                  }`}
                >
                  <div className={`max-w-[88%] sm:max-w-[68%] ${isAdminMsg ? "w-full max-w-[92%] sm:max-w-[85%]" : ""}`}>
                    {isAdminMsg ? (
                      <p className="mb-0.5 px-1 text-center text-[10px] font-semibold uppercase tracking-wide text-violet-300/90">
                        {m.senderLabel ?? "Platform admin"}
                      </p>
                    ) : !m.mine && (m.senderLabel || counterpartLabel) ? (
                      <p className="mb-0.5 px-1 text-[10px] font-medium text-[#D4AF37]/80">
                        {m.senderLabel ?? counterpartLabel}
                      </p>
                    ) : null}
                    <div
                      className={`px-3 py-2 text-[14px] leading-relaxed ${
                        isAdminMsg
                          ? "rounded-2xl border border-violet-400/35 bg-violet-950/70 text-violet-50"
                          : m.mine
                            ? "rounded-2xl rounded-br-md bg-[#00C076] text-white"
                            : "rounded-2xl rounded-bl-md border border-white/[0.08] bg-[rgba(12,17,28,0.85)] text-zinc-100"
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
                            className="max-h-56 w-full object-contain sm:max-h-72"
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
                        className={`mt-0.5 text-right text-[10px] tabular-nums ${
                          isAdminMsg
                            ? "text-violet-200/70"
                            : m.mine
                              ? "text-emerald-50/80"
                              : "text-zinc-500"
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

      <div className={composerCls}>
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
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
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-[#D4AF37] transition active:bg-[#D4AF37]/10 disabled:opacity-40"
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
            className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[16px] text-white outline-none transition placeholder:text-zinc-500 focus:border-[#D4AF37]/40 disabled:opacity-50 sm:text-[14px]"
          />
          <button
            type="button"
            disabled={disabled || !text.trim()}
            onClick={submit}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#00C076] text-white transition active:bg-[#00D684] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
