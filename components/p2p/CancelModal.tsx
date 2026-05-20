"use client";

import { useEffect, useState } from "react";

const CANCEL_REASONS = [
  { value: "unresponsive", label: "Unresponsive user" },
  { value: "terms", label: "Changed terms" },
  { value: "payment", label: "Payment issue" },
  { value: "mistake", label: "Opened by mistake" },
] as const;

type CancelModalProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
};

export function CancelModal({
  open,
  title = "Cancel Trade",
  onClose,
  onConfirm,
  busy,
}: CancelModalProps) {
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]!.value);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setReason(CANCEL_REASONS[0]!.value);
      setConfirmed(false);
    }
  }, [open]);

  if (!open) return null;

  function handleConfirm() {
    if (!confirmed) return;
    onConfirm();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-trade-title"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#D4AF37]/25 bg-[#12161f]/95 p-6 shadow-2xl shadow-black/50 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="cancel-trade-title" className="text-xl font-bold text-white">
          {title}
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Cancelling follows the same rules as before — this form helps us understand what went wrong.
        </p>

        <label className="mt-6 block">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Select reason
          </span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20"
          >
            {CANCEL_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-zinc-600 text-red-600 focus:ring-red-500"
          />
          <span className="text-sm text-zinc-300">
            I confirm I have <strong className="text-white">NOT</strong> paid (or I understand balances will unlock
            per platform rules).
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
            onClick={handleConfirm}
            disabled={busy || !confirmed}
            className="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-900/30 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Cancelling…" : "Cancel Trade"}
          </button>
        </div>
      </div>
    </div>
  );
}
