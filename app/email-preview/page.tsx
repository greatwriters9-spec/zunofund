import type { Metadata } from "next";
import Link from "next/link";

import type { EmailBrandConfig } from "@/lib/email/brand";
import { getEmailBrandWithPlatformContact } from "@/lib/email/brandWithPlatformContact";
import { DEFAULT_STAY_CONNECTED_LINKS } from "@/lib/email/default-stay-connected-links";
import { isEmailPreviewAllowed } from "@/lib/email/preview-access";
import { buildZunoEmailHtml } from "@/lib/email/zuno-layout";

/** Fill gaps so the preview matches production polish when env is empty (development only). */
function previewBrand(base: EmailBrandConfig): EmailBrandConfig {
  if (process.env.NODE_ENV === "production") {
    return base;
  }
  const origin = "http://localhost:3000";
  const socialFallback =
    base.socialLinks.length > 0 ? base.socialLinks : DEFAULT_STAY_CONNECTED_LINKS;
  return {
    ...base,
    websiteUrl: base.websiteUrl ?? origin,
    dashboardUrl: base.dashboardUrl ?? `${origin}/dashboard`,
    adminDeskUrl: base.adminDeskUrl ?? `${origin}/admin`,
    passwordResetUrl: base.passwordResetUrl ?? `${origin}/forgot-password`,
    supportEmail: base.supportEmail ?? "support@example.com",
    socialLinks: socialFallback,
  };
}

export const metadata: Metadata = {
  title: "Email preview",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Search = { variant?: string; secret?: string };

export default async function EmailPreviewPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const secret = typeof sp.secret === "string" ? sp.secret : undefined;
  const variant = sp.variant === "admin" ? "admin" : "investor";

  if (!isEmailPreviewAllowed(secret)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center">
        <h1 className="text-lg font-semibold text-zinc-100">
          Email preview is disabled
        </h1>
        <p className="mt-2 max-w-md text-sm text-zinc-400">
          In production, set{" "}
          <code className="rounded bg-zinc-900 px-1 py-0.5 text-zinc-300">
            EMAIL_PREVIEW_SECRET
          </code>{" "}
          in your environment and open{" "}
          <code className="rounded bg-zinc-900 px-1 py-0.5 text-zinc-300">
            /email-preview?secret=…
          </code>
          . In local development, no secret is required.
        </p>
      </div>
    );
  }

  const brand = previewBrand(await getEmailBrandWithPlatformContact());

  const investorHtml = buildZunoEmailHtml({
    variant: "investor",
    title: "Deposit successful",
    bodyText:
      "Your deposit of $1,000.00 was approved and is now securing your tier lock (30-day maturity).\n\nYou can review activity anytime from your Zuno dashboard.",
    footnoteText:
      "Prefer in-app alerts? Stay signed in — we notify you instantly when something changes.",
    brand,
  });

  const adminHtml = buildZunoEmailHtml({
    variant: "admin",
    title: "New support ticket",
    bodyText:
      "investor@example.com — “Withdrawal hasn’t arrived yet”\n\nOpen the Admin panel to reply and resolve.",
    brand,
  });

  const html = variant === "admin" ? adminHtml : investorHtml;

  const secretQs =
    secret !== undefined && secret.length > 0
      ? `&secret=${encodeURIComponent(secret)}`
      : "";

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-medium uppercase tracking-wider text-amber-400/90">
          Dev tool
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Transactional email preview
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Uses the same layout as{" "}
          <code className="rounded bg-zinc-900 px-1 py-0.5 text-zinc-300">
            /api/webhooks/notify-email
          </code>
          . Footer fields come from{" "}
          <code className="rounded bg-zinc-900 px-1 py-0.5 text-zinc-300">
            EMAIL_*
          </code>{" "}
          env vars (see{" "}
          <code className="rounded bg-zinc-900 px-1 py-0.5 text-zinc-300">
            .env.example
          </code>
          ).
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={`/email-preview?variant=investor${secretQs}`}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              variant === "investor"
                ? "bg-amber-500 text-zinc-950"
                : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            }`}
          >
            Sample: investor
          </Link>
          <Link
            href={`/email-preview?variant=admin${secretQs}`}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              variant === "admin"
                ? "bg-amber-500 text-zinc-950"
                : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            }`}
          >
            Sample: admin
          </Link>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 shadow-xl">
          <iframe
            title="Zuno email HTML preview"
            srcDoc={html}
            className="h-[min(90vh,920px)] w-full bg-[#121212]"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}
