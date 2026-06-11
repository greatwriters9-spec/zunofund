"use client";

import { useState } from "react";

import { ANNOUNCEMENT_CATEGORIES, type AnnouncementRow } from "@/lib/platformConfig/types";

const fieldClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-sm text-white outline-none focus:border-[#D4AF37]/40";

type Props = {
  announcements: AnnouncementRow[];
  onSave: (row: AnnouncementRow) => Promise<void>;
  onCreate: (row: Omit<AnnouncementRow, "id" | "created_at">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const emptyAnnouncement = (): Omit<AnnouncementRow, "id" | "created_at"> => ({
  title: "",
  content: "",
  category: ANNOUNCEMENT_CATEGORIES[0],
  featured: false,
  published: false,
});

export function AdminAnnouncementsManager({
  announcements,
  onSave,
  onCreate,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState(emptyAnnouncement());
  const [showCreate, setShowCreate] = useState(false);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0A0F18]/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#F5E6B3]">Announcements Manager</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Published announcements appear in the Communication Center. Featured items show on the
            dashboard.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-xl border border-[#D4AF37]/30 px-3 py-2 text-xs font-semibold text-[#F5E6B3]"
        >
          {showCreate ? "Cancel" : "Create Announcement"}
        </button>
      </div>

      {showCreate ? (
        <AnnouncementForm
          value={draft}
          onChange={setDraft}
          onSubmit={() => void onCreate(draft).then(() => setShowCreate(false))}
          submitLabel="Create"
        />
      ) : null}

      <div className="mt-5 space-y-4">
        {announcements.map((row) => (
          <AnnouncementEditor key={row.id} row={row} onSave={onSave} onDelete={onDelete} />
        ))}
      </div>
    </section>
  );
}

function AnnouncementForm({
  value,
  onChange,
  onSubmit,
  submitLabel,
}: {
  value: Omit<AnnouncementRow, "id" | "created_at">;
  onChange: (v: Omit<AnnouncementRow, "id" | "created_at">) => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-[#D4AF37]/20 bg-black/20 p-4">
      <input
        className={fieldClass}
        placeholder="Title"
        value={value.title}
        onChange={(e) => onChange({ ...value, title: e.target.value })}
      />
      <textarea
        className={`${fieldClass} min-h-[88px]`}
        placeholder="Content"
        value={value.content}
        onChange={(e) => onChange({ ...value, content: e.target.value })}
      />
      <select
        className={fieldClass}
        value={value.category}
        onChange={(e) => onChange({ ...value, category: e.target.value })}
      >
        {ANNOUNCEMENT_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={value.featured}
          onChange={(e) => onChange({ ...value, featured: e.target.checked })}
        />
        Featured
      </label>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={value.published}
          onChange={(e) => onChange({ ...value, published: e.target.checked })}
        />
        Published
      </label>
      <button
        type="button"
        onClick={onSubmit}
        className="rounded-lg bg-[#D4AF37] px-3 py-2 text-sm font-bold text-black"
      >
        {submitLabel}
      </button>
    </div>
  );
}

function AnnouncementEditor({
  row,
  onSave,
  onDelete,
}: {
  row: AnnouncementRow;
  onSave: (row: AnnouncementRow) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [local, setLocal] = useState(row);

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <input
        className={fieldClass}
        value={local.title}
        onChange={(e) => setLocal({ ...local, title: e.target.value })}
      />
      <textarea
        className={`${fieldClass} mt-2 min-h-[72px]`}
        value={local.content}
        onChange={(e) => setLocal({ ...local, content: e.target.value })}
      />
      <div className="mt-2 flex flex-wrap gap-3">
        <select
          className={fieldClass}
          value={local.category}
          onChange={(e) => setLocal({ ...local, category: e.target.value })}
        >
          {ANNOUNCEMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={local.featured}
            onChange={(e) => setLocal({ ...local, featured: e.target.checked })}
          />
          Featured
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={local.published}
            onChange={(e) => setLocal({ ...local, published: e.target.checked })}
          />
          Published
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void onSave(local)}
          className="rounded-lg bg-[#D4AF37]/20 px-3 py-1.5 text-xs font-semibold text-[#F5E6B3]"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => void onDelete(row.id)}
          className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-300"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
