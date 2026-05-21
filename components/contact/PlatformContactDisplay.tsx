"use client";

import type { ReactNode } from "react";
import { Mail, MessageCircle, Phone, Send } from "lucide-react";

import {
  displayWhatsapp,
  mailtoUrl,
  telUrl,
  telegramUrl,
  whatsappUrl,
  type PlatformContact,
} from "@/lib/platformContact";
import { usePlatformContact } from "@/lib/usePlatformContact";

type Variant = "cards" | "compact";

function ContactRow({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href?: string | null;
}) {
  if (!value) return null;

  const inner = (
    <>
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-yellow-500/10">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-zinc-500">{label}</p>
        <h3 className="truncate text-lg font-bold">{value}</h3>
      </div>
    </>
  );

  const className =
    "flex items-center gap-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-yellow-500/30";

  if (href) {
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }

  return <div className={className}>{inner}</div>;
}

function CardsView({ contact }: { contact: PlatformContact }) {
  const wa = displayWhatsapp(contact);

  return (
    <div className="mt-12 space-y-5">
      <ContactRow
        icon={<Mail className="h-6 w-6 text-yellow-600" />}
        label="Email Support"
        value={contact.support_email}
        href={mailtoUrl(contact.support_email)}
      />
      <ContactRow
        icon={<Phone className="h-6 w-6 text-yellow-600" />}
        label="Direct Phone Line"
        value={contact.support_phone}
        href={telUrl(contact.support_phone)}
      />
      <ContactRow
        icon={<Send className="h-6 w-6 text-yellow-600" />}
        label="Telegram Support"
        value={contact.telegram}
        href={telegramUrl(contact.telegram)}
      />
      <ContactRow
        icon={<MessageCircle className="h-6 w-6 text-yellow-600" />}
        label="WhatsApp Assistance"
        value={wa}
        href={whatsappUrl(wa)}
      />
    </div>
  );
}

function CompactView({ contact }: { contact: PlatformContact }) {
  const wa = displayWhatsapp(contact);

  return (
    <div className="mt-2 space-y-0.5 text-[11px] text-zinc-500">
      {contact.support_email ? (
        <p className="truncate">
          {mailtoUrl(contact.support_email) ? (
            <a
              href={mailtoUrl(contact.support_email)!}
              className="hover:text-yellow-500/90"
            >
              {contact.support_email}
            </a>
          ) : (
            contact.support_email
          )}
        </p>
      ) : null}
      {contact.support_phone ? (
        <p>
          {telUrl(contact.support_phone) ? (
            <a href={telUrl(contact.support_phone)!} className="hover:text-yellow-500/90">
              {contact.support_phone}
            </a>
          ) : (
            contact.support_phone
          )}
        </p>
      ) : null}
      {!contact.support_phone && wa ? <p>{wa}</p> : null}
    </div>
  );
}

export function PlatformContactDisplay({ variant = "cards" }: { variant?: Variant }) {
  const { contact, loading } = usePlatformContact();

  if (loading && !contact.support_email && !contact.support_phone) {
    return (
      <div
        className={
          variant === "cards"
            ? "mt-12 space-y-5 animate-pulse"
            : "mt-2 h-8 rounded bg-zinc-800/60"
        }
        aria-hidden
      />
    );
  }

  return variant === "cards" ? <CardsView contact={contact} /> : <CompactView contact={contact} />;
}
