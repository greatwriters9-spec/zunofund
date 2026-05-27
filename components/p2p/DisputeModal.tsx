"use client";

import { useEffect, useState } from "react";

type DisputeModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  busy?: boolean;
};

export function DisputeModal({ open, onClose, onConfirm, busy }: DisputeModalProps) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setConfirmed(false);
    }
  }, [open]);

  if (!open) return null;

  const trimmed = reason.trim();
  const canSubmit = confirmed && trimmed.length >= 3;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispute-trade-title"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#12161f]/95 p-6 shadow-2xl shadow-black/50 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dispute-trade-title" className="text-xl font-bold text-white">
          Open dispute
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          An admin will join this chat to review payment proof and decide who receives the
          escrowed crypto. Release and cancel buttons are paused until resolved.
        </p>

        <label className="mt-6 block">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            What went wrong?
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="e.g. Paid but merchant will not release / did not receive fiat…"
            className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
          />
        </label>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-zinc-600 text-amber-500 focus:ring-amber-500"
          />
          <span className="text-sm text-zinc-300">
            I confirm the facts above are accurate. I understand an admin decision is final for
            on-platform crypto.
          </span>
        </label>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-zinc-600 px-6 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => onConfirm(trimmed)}
            disabled={busy || !canSubmit}
            className="rounded-xl bg-amber-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-amber-900/30 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Opening…" : "Open dispute"}
          </button>
        </div>
      </div>
    </div>
  );
}
