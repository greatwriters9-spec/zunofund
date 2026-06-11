"use client";

import { useState } from "react";

import type { InvestmentPlanRow } from "@/lib/platformConfig/types";

const fieldClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-sm text-white outline-none focus:border-[#D4AF37]/40";

type Props = {
  plans: InvestmentPlanRow[];
  onSave: (plan: InvestmentPlanRow) => Promise<void>;
  onCreate: (plan: Omit<InvestmentPlanRow, "id" | "created_at" | "updated_at">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const emptyDraft = (): Omit<InvestmentPlanRow, "id" | "created_at" | "updated_at"> => ({
  name: "",
  min_deposit: 0,
  max_deposit: 0,
  daily_roi: 0,
  promotion_return_target: 0,
  promotion_active: true,
  sort_order: 99,
});

export function AdminInvestmentPlansManager({ plans, onSave, onCreate, onDelete }: Props) {
  const [draft, setDraft] = useState(emptyDraft());
  const [showCreate, setShowCreate] = useState(false);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0A0F18]/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#F5E6B3]">Investment Plans Manager</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Plans drive ROI, deposit ranges, and the projected returns table on the dashboard.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-xl border border-[#D4AF37]/30 px-3 py-2 text-xs font-semibold text-[#F5E6B3]"
        >
          {showCreate ? "Cancel" : "Create Plan"}
        </button>
      </div>

      {showCreate ? (
        <div className="mt-4 grid gap-3 rounded-xl border border-[#D4AF37]/20 bg-black/20 p-4 sm:grid-cols-2">
          {(
            [
              ["name", "Plan Name", "text"],
              ["min_deposit", "Min Deposit", "number"],
              ["max_deposit", "Max Deposit", "number"],
              ["daily_roi", "Daily ROI %", "number"],
              ["promotion_return_target", "Promotion Target", "number"],
              ["sort_order", "Sort Order", "number"],
            ] as const
          ).map(([key, label, type]) => (
            <label key={key} className="block">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
              <input
                type={type}
                className={`${fieldClass} mt-1`}
                value={String(draft[key as keyof typeof draft] ?? "")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    [key]:
                      type === "number"
                        ? Number(e.target.value)
                        : e.target.value,
                  })
                }
              />
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm text-zinc-300 sm:col-span-2">
            <input
              type="checkbox"
              checked={draft.promotion_active}
              onChange={(e) => setDraft({ ...draft, promotion_active: e.target.checked })}
            />
            Active
          </label>
          <button
            type="button"
            onClick={() => void onCreate(draft).then(() => setShowCreate(false))}
            className="rounded-lg bg-[#D4AF37] px-3 py-2 text-sm font-bold text-black sm:col-span-2"
          >
            Create Plan
          </button>
        </div>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="px-2 py-2">Plan</th>
              <th className="px-2 py-2">Min</th>
              <th className="px-2 py-2">Max</th>
              <th className="px-2 py-2">Daily ROI</th>
              <th className="px-2 py-2">Target</th>
              <th className="px-2 py-2">Active</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                onSave={onSave}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PlanRow({
  plan,
  onSave,
  onDelete,
}: {
  plan: InvestmentPlanRow;
  onSave: (plan: InvestmentPlanRow) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [local, setLocal] = useState(plan);

  return (
    <tr className="border-b border-white/5">
      <td className="px-2 py-2">
        <input
          className={fieldClass}
          value={local.name}
          onChange={(e) => setLocal({ ...local, name: e.target.value })}
        />
      </td>
      {(
        [
          "min_deposit",
          "max_deposit",
          "daily_roi",
          "promotion_return_target",
        ] as const
      ).map((key) => (
        <td key={key} className="px-2 py-2">
          <input
            type="number"
            className={fieldClass}
            value={local[key]}
            onChange={(e) => setLocal({ ...local, [key]: Number(e.target.value) })}
          />
        </td>
      ))}
      <td className="px-2 py-2">
        <input
          type="checkbox"
          checked={local.promotion_active}
          onChange={(e) => setLocal({ ...local, promotion_active: e.target.checked })}
        />
      </td>
      <td className="px-2 py-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void onSave(local)}
            className="rounded-lg bg-[#D4AF37]/20 px-2 py-1 text-xs font-semibold text-[#F5E6B3]"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => void onDelete(plan.id)}
            className="rounded-lg bg-red-500/15 px-2 py-1 text-xs font-semibold text-red-300"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
