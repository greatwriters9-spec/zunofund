export type PlatformContact = {
  support_email: string;
  support_phone: string;
  whatsapp: string;
  telegram: string;
  updated_at: string | null;
};

export const PLATFORM_CONTACT_ID = "default";

export const EMPTY_PLATFORM_CONTACT: PlatformContact = {
  support_email: "",
  support_phone: "",
  whatsapp: "",
  telegram: "",
  updated_at: null,
};

export function normalizePlatformContactRow(
  row: Partial<PlatformContact> | null | undefined,
): PlatformContact {
  if (!row) return { ...EMPTY_PLATFORM_CONTACT };
  return {
    support_email: (row.support_email ?? "").trim(),
    support_phone: (row.support_phone ?? "").trim(),
    whatsapp: (row.whatsapp ?? "").trim(),
    telegram: (row.telegram ?? "").trim(),
    updated_at: row.updated_at ?? null,
  };
}

/** WhatsApp display falls back to phone when unset. */
export function displayWhatsapp(contact: PlatformContact): string {
  return contact.whatsapp || contact.support_phone;
}

export function telegramUrl(handle: string): string | null {
  const t = handle.trim();
  if (!t) return null;
  const slug = t.replace(/^@+/, "");
  if (!slug) return null;
  return `https://t.me/${encodeURIComponent(slug)}`;
}

export function whatsappUrl(number: string): string | null {
  const digits = number.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export function mailtoUrl(email: string): string | null {
  const e = email.trim();
  if (!e) return null;
  return `mailto:${e}`;
}

export function telUrl(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return null;
  return `tel:${digits}`;
}
