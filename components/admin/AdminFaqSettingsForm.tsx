"use client";

import { useEffect, useState } from "react";

import { normalizePlatformFaqRows, type PlatformFaq } from "@/lib/platformFaq";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";
import {
  invalidatePlatformFaqsCache,
  PLATFORM_FAQS_CHANGED_EVENT,
} from "@/lib/usePlatformFaqs";

type DraftFaq = Pick<PlatformFaq, "id" | "question" | "answer" | "is_active">;

function blankFaq(): DraftFaq {
  return {
    id: `new-${Date.now()}`,
    question: "",
    answer: "",
    is_active: true,
  };
}

export function AdminFaqSettingsForm({
  initial,
  onSaved,
}: {
  initial: PlatformFaq[];
  onSaved?: (faqs: PlatformFaq[]) => void;
}) {
  const supabase = useSupabase();
  const [items, setItems] = useState<DraftFaq[]>(
    () =>
      initial.map((faq) => ({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        is_active: faq.is_active,
      })),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(
      initial.map((faq) => ({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        is_active: faq.is_active,
      })),
    );
  }, [initial]);

  function updateItem(index: number, patch: Partial<DraftFaq>) {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function moveItem(index: number, delta: number) {
    setItems((current) => {
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (!item) return current;
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const payload = items.map((item, index) => ({
      question: item.question,
      answer: item.answer,
      is_active: item.is_active,
      sort_order: index,
    }));

    const { data, error: rpcError } = await supabase.rpc("admin_replace_platform_faqs", {
      p_items: payload,
    });

    setBusy(false);

    if (rpcError) {
      setError(formatSupabaseError(rpcError));
      return;
    }

    invalidatePlatformFaqsCache();
    window.dispatchEvent(new Event(PLATFORM_FAQS_CHANGED_EVENT));
    const saved = normalizePlatformFaqRows(data);
    onSaved?.(saved);
    setItems(
      saved.map((faq) => ({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        is_active: faq.is_active,
      })),
    );
    window.localStorage.setItem(PLATFORM_FAQS_CHANGED_EVENT, String(Date.now()));
    setMessage(`FAQs saved. ${saved.filter((faq) => faq.is_active).length} published FAQ(s) will show on the contact page.`);
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-5">
      <div className="space-y-4">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="rounded-2xl border border-zinc-800 bg-black/35 p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                FAQ {index + 1}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  className="rounded-lg border border-zinc-700 px-2 py-1 text-zinc-300 disabled:opacity-40"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1}
                  className="rounded-lg border border-zinc-700 px-2 py-1 text-zinc-300 disabled:opacity-40"
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setItems((current) => current.filter((_, i) => i !== index))
                  }
                  className="rounded-lg border border-red-500/40 px-2 py-1 text-red-300"
                >
                  Remove
                </button>
              </div>
            </div>

            <label className="mb-3 block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Question
              </span>
              <input
                type="text"
                value={item.question}
                onChange={(e) => updateItem(index, { question: e.target.value })}
                required
                className="w-full rounded-xl border border-zinc-700 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-yellow-500/50"
                placeholder="How long do withdrawals take?"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Answer
              </span>
              <textarea
                value={item.answer}
                onChange={(e) => updateItem(index, { answer: e.target.value })}
                required
                rows={4}
                className="w-full resize-y rounded-xl border border-zinc-700 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-yellow-500/50"
                placeholder="Write the answer shown on the public contact page."
              />
            </label>

            <label className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={item.is_active}
                onChange={(e) =>
                  updateItem(index, { is_active: e.target.checked })
                }
                className="size-4 rounded border-zinc-600 bg-zinc-900 text-yellow-500 focus:ring-yellow-500/40"
              />
              Published on contact page
            </label>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setItems((current) => [...current, blankFaq()])}
          className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-bold text-zinc-200 transition hover:border-yellow-500/50"
        >
          Add FAQ
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-yellow-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-yellow-400 disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save FAQs"}
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-400" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
