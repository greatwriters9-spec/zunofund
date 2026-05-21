/**
 * Transactional email branding (server-side). Configure via env on the host.
 */

export type EmailBrandConfig = {
  brandName: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  /** Primary app CTA target (defaults to website + /dashboard). */
  dashboardUrl: string | null;
  /** Admin CTA target (defaults to website + /admin). */
  adminDeskUrl: string | null;
  passwordResetUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  /** Lines shown in the footer (use `|` in env to separate lines). */
  companyAddressLines: string[];
  /** Short line under the signature, e.g. regulatory disclaimer. */
  footerTagline: string | null;
  /**
   * Label/URL pairs for “Stay connected”: X|https://x.com/zuno|Telegram|https://t.me/…
   */
  socialLinks: { label: string; url: string }[];
  /**
   * Optional absolute base for `/email/social/{slug}.svg` (no trailing slash).
   * Defaults to `{website}/email/social`.
   */
  socialIconBaseUrl: string | null;
  /**
   * `icons`: load `/email/social/{slug}.svg` when label maps to a slug.
   * `text`: gold text links only (no remote SVG icons). Env: `EMAIL_SOCIAL_LINK_STYLE=text`.
   */
  socialLinkStyle: "icons" | "text";
};

function trimOrNull(v: string | undefined): string | null {
  const t = v?.trim();
  return t && t.length > 0 ? t : null;
}

function splitPipeMultiline(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinOriginPath(origin: string, path: string): string {
  const base = origin.replace(/\/$/, "");
  const seg = path.startsWith("/") ? path : `/${path}`;
  return `${base}${seg}`;
}

function parseSocialLinkPairs(raw: string | undefined): {
  label: string;
  url: string;
}[] {
  if (!raw?.trim()) return [];
  const parts = raw.split("|").map((s) => s.trim()).filter(Boolean);
  const out: { label: string; url: string }[] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const label = parts[i];
    const url = parts[i + 1];
    if (
      label &&
      url &&
      (/^https?:\/\//i.test(url) || url.toLowerCase().startsWith("mailto:"))
    ) {
      out.push({ label, url });
    }
  }
  return out;
}

/** https://{VERCEL_URL} when Vercel injects the deployment hostname (no protocol). */
function inferSiteUrlFromVercel(): string | null {
  const raw = process.env.VERCEL_URL?.trim();
  if (!raw) return null;
  const host = raw.replace(/^https?:\/\//i, "").split("/")[0]?.trim();
  if (!host || /[\s\\/]/.test(host)) return null;
  return `https://${host}`;
}

export type GetEmailBrandConfigOpts = {
  /**
   * When public site URL env vars are unset, use this absolute origin (e.g.
   * from `siteOriginFromRequest` on `/api/webhooks/notify-email`).
   */
  preferSiteUrl?: string | null;
};

/** Reads env each call so tests / preview pick up changes without module cache surprises. */
export function applyPlatformContactToBrand(
  brand: EmailBrandConfig,
  contact: {
    support_email?: string | null;
    support_phone?: string | null;
    telegram?: string | null;
  },
): EmailBrandConfig {
  const email = contact.support_email?.trim();
  const phone = contact.support_phone?.trim();
  const telegram = contact.telegram?.trim();

  const socialLinks = [...brand.socialLinks];
  if (telegram) {
    const url = `https://t.me/${telegram.replace(/^@+/, "")}`;
    const hasTelegram = socialLinks.some(
      (l) => l.label.toLowerCase().includes("telegram") || l.url.includes("t.me/"),
    );
    if (!hasTelegram && url.length > "https://t.me/".length) {
      socialLinks.push({ label: "Telegram", url });
    }
  }

  return {
    ...brand,
    supportEmail: email || null,
    supportPhone: phone || null,
    socialLinks,
  };
}

export function getEmailBrandConfig(
  opts?: GetEmailBrandConfigOpts,
): EmailBrandConfig {
  const websiteUrl =
    trimOrNull(process.env.EMAIL_WEBSITE_URL) ??
    trimOrNull(process.env.NEXT_PUBLIC_SITE_URL) ??
    trimOrNull(opts?.preferSiteUrl ?? undefined) ??
    inferSiteUrlFromVercel();

  const dashboardUrl =
    trimOrNull(process.env.EMAIL_DASHBOARD_URL) ??
    (websiteUrl ? joinOriginPath(websiteUrl, "/dashboard") : null);

  const adminDeskUrl =
    trimOrNull(process.env.EMAIL_ADMIN_URL) ??
    (websiteUrl ? joinOriginPath(websiteUrl, "/admin") : null);

  const passwordResetUrl =
    trimOrNull(process.env.EMAIL_PASSWORD_RESET_URL) ??
    (websiteUrl ? joinOriginPath(websiteUrl, "/forgot-password") : null);

  const linkStyleRaw =
    process.env.EMAIL_SOCIAL_LINK_STYLE?.trim().toLowerCase() ?? "";

  return {
    brandName: trimOrNull(process.env.EMAIL_BRAND_NAME) ?? "Zuno",
    logoUrl: trimOrNull(process.env.EMAIL_LOGO_URL),
    websiteUrl,
    dashboardUrl,
    adminDeskUrl,
    passwordResetUrl,
    supportEmail: trimOrNull(process.env.EMAIL_SUPPORT_EMAIL),
    supportPhone: trimOrNull(process.env.EMAIL_SUPPORT_PHONE),
    companyAddressLines: splitPipeMultiline(process.env.EMAIL_COMPANY_ADDRESS),
    footerTagline: trimOrNull(process.env.EMAIL_FOOTER_TAGLINE),
    socialLinks: parseSocialLinkPairs(process.env.EMAIL_SOCIAL_LINKS),
    socialIconBaseUrl: trimOrNull(process.env.EMAIL_SOCIAL_ICON_BASE_URL),
    socialLinkStyle: linkStyleRaw === "text" ? "text" : "icons",
  };
}
