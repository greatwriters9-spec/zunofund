"use client";

import type { PromotionSettingsRow } from "@/lib/platformConfig/types";

const fieldClass =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#D4AF37]/40";

type Props = {
  settings: PromotionSettingsRow;
  onChange: (next: PromotionSettingsRow) => void;
  onSave: () => void;
  saving: boolean;
};

export function AdminPromotionSettingsForm({ settings, onChange, onSave, saving }: Props) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0A0F18]/80 p-5">
      <h2 className="text-lg font-semibold text-[#F5E6B3]">Promotion Settings</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Controls the dashboard promotion card and campaign messaging.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Promotion Title
          </span>
          <input
            className={`${fieldClass} mt-1`}
            value={settings.promotion_title}
            onChange={(e) => onChange({ ...settings, promotion_title: e.target.value })}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Promotion Description
          </span>
          <textarea
            className={`${fieldClass} mt-1 min-h-[88px]`}
            value={settings.promotion_description ?? ""}
            onChange={(e) => onChange({ ...settings, promotion_description: e.target.value })}
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Promotion End Date
          </span>
          <input
            type="datetime-local"
            className={`${fieldClass} mt-1`}
            value={settings.promotion_end_date.slice(0, 16)}
            onChange={(e) =>
              onChange({
                ...settings,
                promotion_end_date: new Date(e.target.value).toISOString(),
              })
            }
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Partner Fund Amount (USD)
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            className={`${fieldClass} mt-1`}
            value={settings.partner_fund_amount ?? ""}
            onChange={(e) =>
              onChange({
                ...settings,
                partner_fund_amount: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={settings.is_active}
            onChange={(e) => onChange({ ...settings, is_active: e.target.checked })}
          />
          Promotion Active
        </label>

        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={settings.show_countdown}
            onChange={(e) => onChange({ ...settings, show_countdown: e.target.checked })}
          />
          Show Countdown
        </label>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="mt-5 rounded-xl bg-[#D4AF37] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save Promotion Settings"}
      </button>
    </section>
  );
}
