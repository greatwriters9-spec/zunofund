"use client";

import { useEffect, useState } from "react";

import { formatSupabaseError, useSupabase } from "@/lib/supabase";
import {
  invalidatePlatformContactCache,
  PLATFORM_CONTACT_CHANGED_EVENT,
} from "@/lib/usePlatformContact";
import type { PlatformContact } from "@/lib/platformContact";

export function AdminContactSettingsForm({
  initial,
}: {
  initial: PlatformContact;
}) {
  const supabase = useSupabase();
  const [supportEmail, setSupportEmail] = useState(initial.support_email);
  const [supportPhone, setSupportPhone] = useState(initial.support_phone);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [telegram, setTelegram] = useState(initial.telegram);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupportEmail(initial.support_email);
    setSupportPhone(initial.support_phone);
    setWhatsapp(initial.whatsapp);
    setTelegram(initial.telegram);
  }, [initial]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const { error: rpcError } = await supabase.rpc("admin_update_platform_contact", {
      p_support_email: supportEmail,
      p_support_phone: supportPhone,
      p_whatsapp: whatsapp,
      p_telegram: telegram,
    });

    setBusy(false);

    if (rpcError) {
      setError(formatSupabaseError(rpcError));
      return;
    }

    invalidatePlatformContactCache();
    window.dispatchEvent(new Event(PLATFORM_CONTACT_CHANGED_EVENT));
    setMessage("Contact information saved. It will appear across the site and in emails.");
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Support email
          </span>
          <input
            type="email"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-zinc-700 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-yellow-500/50"
            placeholder="support@example.com"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Phone
          </span>
          <input
            type="text"
            value={supportPhone}
            onChange={(e) => setSupportPhone(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-yellow-500/50"
            placeholder="+254 …"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            WhatsApp
          </span>
          <input
            type="text"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-yellow-500/50"
            placeholder="Leave blank to use phone"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Telegram
          </span>
          <input
            type="text"
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-yellow-500/50"
            placeholder="@handle"
          />
        </label>
      </div>

      <p className="text-xs text-zinc-500 leading-relaxed">
        These values replace hardcoded contact details on the landing contact page, investor
        dashboard, and transactional email footers.
      </p>

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

      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-yellow-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-yellow-400 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save contact info"}
      </button>
    </form>
  );
}
