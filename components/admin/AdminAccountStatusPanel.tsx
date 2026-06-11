"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ACCOUNT_STATUS_BADGE_CLASS,
  ACCOUNT_STATUS_LABEL,
  formatWithdrawalEligibilityLabel,
  normalizeAccountStatus,
  type AccountStatus,
  type AccountStatusHistoryRow,
} from "@/lib/accountStatus";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type AdminAccountStatusPanelProps = {
  investorId: string;
  currentStatus: string | null | undefined;
  currentReason: string | null | undefined;
  statusUpdatedAt: string | null | undefined;
  withdrawalEligibleAt?: string | null;
  onSaved: () => void;
  onWithdrawalDateSaved?: (investorId: string, withdrawalEligibleAt: string | null) => void;
};

const STATUS_OPTIONS: AccountStatus[] = ["active", "on_hold", "suspended", "banned"];

export function AdminAccountStatusPanel({
  investorId,
  currentStatus,
  currentReason,
  statusUpdatedAt,
  withdrawalEligibleAt,
  onSaved,
  onWithdrawalDateSaved,
}: AdminAccountStatusPanelProps) {
  const supabase = useSupabase();
  const normalized = normalizeAccountStatus(currentStatus);
  const [draftStatus, setDraftStatus] = useState<AccountStatus>(normalized);
  const [reason, setReason] = useState(currentReason ?? "");
  const [history, setHistory] = useState<AccountStatusHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingDate, setSavingDate] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [dateMessage, setDateMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [withdrawalEligibleAtDraft, setWithdrawalEligibleAtDraft] = useState("");
  const [savedWithdrawalEligibleAt, setSavedWithdrawalEligibleAt] = useState<string | null>(
    withdrawalEligibleAt ?? null,
  );

  useEffect(() => {
    setDraftStatus(normalizeAccountStatus(currentStatus));
    setReason(currentReason ?? "");
    setSavedWithdrawalEligibleAt(withdrawalEligibleAt ?? null);
    setWithdrawalEligibleAtDraft(toDatetimeLocalValue(withdrawalEligibleAt));
  }, [currentStatus, currentReason, investorId, withdrawalEligibleAt]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const { data, error: histError } = await supabase.rpc(
      "admin_list_account_status_history",
      { p_investor_id: investorId },
    );
    if (histError) {
      setHistory([]);
    } else {
      setHistory((data as AccountStatusHistoryRow[]) ?? []);
    }
    setHistoryLoading(false);
  }, [supabase, investorId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function saveStatus() {
    setSavingStatus(true);
    setError(null);
    setStatusMessage(null);

    const { data, error: rpcError } = await supabase.rpc(
      "admin_update_investor_account_status",
      {
        p_investor_id: investorId,
        p_new_status: draftStatus,
        p_reason: reason.trim() || null,
      },
    );

    setSavingStatus(false);

    if (rpcError) {
      setError(formatSupabaseError(rpcError));
      return;
    }

    const unchanged =
      data &&
      typeof data === "object" &&
      "unchanged" in (data as object) &&
      (data as { unchanged?: boolean }).unchanged;

    setStatusMessage(
      unchanged
        ? "No status changes to save."
        : `Account status updated to ${ACCOUNT_STATUS_LABEL[draftStatus]}. Changes are live.`,
    );
    await loadHistory();
    onSaved();
  }

  async function saveWithdrawalDate() {
    setSavingDate(true);
    setError(null);
    setDateMessage(null);

    let withdrawalIso: string | null = null;
    if (withdrawalEligibleAtDraft.trim()) {
      const parsed = new Date(withdrawalEligibleAtDraft);
      if (Number.isNaN(parsed.getTime())) {
        setSavingDate(false);
        setError("Invalid date/time. Please pick a valid withdrawal date.");
        return;
      }
      withdrawalIso = parsed.toISOString();
    }

    let savedAt: string | null = withdrawalIso;

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "admin_set_investor_withdrawal_eligible_at",
      {
        p_investor_id: investorId,
        p_withdrawal_eligible_at: withdrawalIso,
      },
    );

    if (rpcError) {
      let response: Response;
      try {
        response = await fetch("/api/admin/investors/withdrawal-eligible-at", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            investorId,
            withdrawalEligibleAt: withdrawalIso,
          }),
        });
      } catch {
        setSavingDate(false);
        setError(formatSupabaseError(rpcError));
        return;
      }

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        withdrawal_eligible_at?: string | null;
      } | null;

      setSavingDate(false);

      if (!response.ok) {
        setError(payload?.error ?? formatSupabaseError(rpcError));
        return;
      }

      savedAt = payload?.withdrawal_eligible_at ?? withdrawalIso;
    } else {
      setSavingDate(false);
      const row = rpcData as { withdrawal_eligible_at?: string | null } | null;
      savedAt = row?.withdrawal_eligible_at ?? withdrawalIso;
    }
    setSavedWithdrawalEligibleAt(savedAt);
    setWithdrawalEligibleAtDraft(toDatetimeLocalValue(savedAt));
    onWithdrawalDateSaved?.(investorId, savedAt);
    setDateMessage(
      savedAt
        ? `Withdrawal date saved: ${formatWithdrawalEligibilityLabel(savedAt)}. Visible to investor immediately.`
        : "Withdrawal date cleared. Visible to investor immediately.",
    );
    onSaved();
  }

  return (
    <div className="space-y-4 rounded-xl border border-zinc-800 bg-black/30 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-white">Account Status Controls</h3>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ACCOUNT_STATUS_BADGE_CLASS[normalized]}`}
        >
          {ACCOUNT_STATUS_LABEL[normalized]}
        </span>
      </div>

      {currentReason ? (
        <p className="text-xs text-zinc-400">
          <span className="text-zinc-500">Current reason: </span>
          {currentReason}
        </p>
      ) : null}

      {statusUpdatedAt ? (
        <p className="text-xs text-zinc-500">
          Last updated: {new Date(statusUpdatedAt).toLocaleString()}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Account status</label>
          <select
            className="w-full rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm outline-none focus:border-yellow-500"
            value={draftStatus}
            onChange={(e) => setDraftStatus(e.target.value as AccountStatus)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {ACCOUNT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Status reason</label>
          <textarea
            className="min-h-[80px] w-full rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm outline-none focus:border-yellow-500"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this status was applied…"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setDraftStatus(s)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              draftStatus === s
                ? ACCOUNT_STATUS_BADGE_CLASS[s]
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            Set {ACCOUNT_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={savingStatus}
        onClick={() => void saveStatus()}
        className="rounded-xl bg-yellow-500 px-5 py-2 text-sm font-semibold text-black transition hover:bg-yellow-400 disabled:opacity-50"
      >
        {savingStatus ? "Saving…" : "Save account status"}
      </button>

      {statusMessage ? (
        <p className="text-sm text-green-300" role="status">
          {statusMessage}
        </p>
      ) : null}

      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
          <h4 className="text-sm font-semibold text-white">Withdrawal eligible from</h4>
          {savedWithdrawalEligibleAt ? (
            <p className="text-xs text-zinc-400">
              Currently saved:{" "}
              <span className="text-[#F5E6B3]">
                {formatWithdrawalEligibilityLabel(savedWithdrawalEligibleAt)}
              </span>
            </p>
          ) : (
            <p className="text-xs text-zinc-500">No withdrawal date set yet.</p>
          )}
          <input
            type="datetime-local"
            value={withdrawalEligibleAtDraft}
            onChange={(e) => setWithdrawalEligibleAtDraft(e.target.value)}
            className="w-full max-w-sm rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm outline-none focus:border-yellow-500"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={savingDate}
              onClick={() => void saveWithdrawalDate()}
              className="rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-5 py-2 text-sm font-semibold text-[#F5E6B3] transition hover:bg-[#D4AF37]/25 disabled:opacity-50"
            >
              {savingDate ? "Saving…" : "Save withdrawal date"}
            </button>
            {withdrawalEligibleAtDraft ? (
              <button
                type="button"
                disabled={savingDate}
                onClick={() => setWithdrawalEligibleAtDraft("")}
                className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
              >
                Clear field
              </button>
            ) : null}
          </div>
          <p className="text-xs text-zinc-500">
            Informational only — shown on the investor dashboard and status screens. Does not
            trigger automatic withdrawals.
          </p>
          {dateMessage ? (
            <p className="text-sm text-green-300" role="status">
              {dateMessage}
            </p>
          ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="border-t border-zinc-800 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Status history
        </h4>
        {historyLoading ? (
          <p className="mt-2 text-xs text-zinc-500">Loading history…</p>
        ) : history.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">No status changes recorded yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {history.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300"
              >
                <p>
                  <span className="text-zinc-500">
                    {new Date(row.created_at).toLocaleString()}
                  </span>
                  {" · "}
                  {row.old_status ? `${row.old_status} → ` : ""}
                  <strong className="text-white">{row.new_status}</strong>
                </p>
                {row.reason ? (
                  <p className="mt-1 text-zinc-400">Reason: {row.reason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
