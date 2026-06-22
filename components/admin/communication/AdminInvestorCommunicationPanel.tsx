"use client";

import { useEffect, useState } from "react";

import { formatSupabaseError, useSupabase } from "@/lib/supabase";

type CommHistory = {
  investor_email?: string;
  email_threads?: Array<{ id: string; subject: string; status: string; last_message_at: string }>;
  support_tickets?: Array<{ id: string; subject: string; status: string; created_at: string }>;
  notifications?: Array<{ id: string; title: string; type: string; created_at: string }>;
  admin_notes?: Array<{ id: string; note: string; created_at: string }>;
};

type Props = {
  investorId: string;
};

export function AdminInvestorCommunicationPanel({ investorId }: Props) {
  const supabase = useSupabase();
  const [history, setHistory] = useState<CommHistory | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    const { data, error: e } = await supabase.rpc("admin_get_investor_communication_history", {
      p_investor_id: investorId,
    });
    if (e) {
      setError(formatSupabaseError(e));
      return;
    }
    setHistory(data as CommHistory);
  }

  useEffect(() => {
    if (open) void load();
  }, [open, investorId]);

  async function saveNote() {
    if (!note.trim()) return;
    const { error: e } = await supabase.rpc("admin_add_investor_note", {
      p_investor_id: investorId,
      p_note: note.trim(),
    });
    if (e) {
      setError(formatSupabaseError(e));
      return;
    }
    setNote("");
    await load();
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-[#F5E6B3]"
      >
        Communication history
        <span className="text-xs text-zinc-500">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3 text-sm">
          {error ? <p className="text-red-300">{error}</p> : null}

          <div>
            <p className="text-xs font-semibold uppercase text-zinc-500">Support tickets</p>
            <ul className="mt-1 space-y-1 text-zinc-300">
              {(history?.support_tickets ?? []).length === 0 ? (
                <li className="text-zinc-600">None</li>
              ) : (
                history?.support_tickets?.map((t) => (
                  <li key={t.id}>
                    {t.subject} · {t.status}
                  </li>
                ))
              )}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase text-zinc-500">Email threads</p>
            <ul className="mt-1 space-y-1 text-zinc-300">
              {(history?.email_threads ?? []).length === 0 ? (
                <li className="text-zinc-600">None</li>
              ) : (
                history?.email_threads?.map((t) => (
                  <li key={t.id}>
                    {t.subject} · {t.status}
                  </li>
                ))
              )}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase text-zinc-500">Platform notifications</p>
            <ul className="mt-1 max-h-24 space-y-1 overflow-y-auto text-zinc-300">
              {(history?.notifications ?? []).slice(0, 5).map((n) => (
                <li key={n.id}>{n.title}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase text-zinc-500">Admin notes</p>
            <ul className="mt-1 space-y-1 text-zinc-300">
              {(history?.admin_notes ?? []).map((n) => (
                <li key={n.id} className="rounded-lg bg-white/5 px-2 py-1">
                  {n.note}
                </li>
              ))}
            </ul>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Add internal note…"
              className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
            />
            <button
              type="button"
              onClick={() => void saveNote()}
              className="mt-1 rounded-lg border border-[#D4AF37]/30 px-2 py-1 text-xs text-[#F5E6B3]"
            >
              Save note
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
