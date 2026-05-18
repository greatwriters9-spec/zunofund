/**
 * Map notification labels to filenames under `/public/email/social/*.svg`
 * (Simple Icons–derived assets, CC0).
 */

import type { EmailBrandConfig } from "@/lib/email/brand";

const LABEL_SLUG: Record<string, string> = {
  x: "x",
  twitter: "x",
  telegram: "telegram",
  tg: "telegram",
  facebook: "facebook",
  fb: "facebook",
  linkedin: "linkedin",
  youtube: "youtube",
  yt: "youtube",
  instagram: "instagram",
  ig: "instagram",
  reddit: "reddit",
  discord: "discord",
};

export function socialSlugFromLabel(label: string): string | null {
  const cleaned = label
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "")
    .trim();
  if (LABEL_SLUG[cleaned]) return LABEL_SLUG[cleaned];
  const token = cleaned.split(/[^a-z0-9]+/).find((t) => t.length > 0);
  if (token && LABEL_SLUG[token]) return LABEL_SLUG[token];
  return null;
}

/** Homepage row (brand label + site URL) uses the generic globe asset. */
export function socialIconSlugForLink(opts: {
  label: string;
  url: string;
  websiteUrl: string | null;
}): string | null {
  const fromLabel = socialSlugFromLabel(opts.label);
  if (fromLabel) return fromLabel;
  const w = opts.websiteUrl?.trim();
  if (w && opts.url.trim() === w) return "website";
  return null;
}

export function absoluteSocialIconUrl(base: string, slug: string): string {
  return `${base.replace(/\/$/, "")}/${slug}.svg`;
}

export function resolveSocialIconBase(brand: EmailBrandConfig): string | null {
  const explicit = brand.socialIconBaseUrl?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const site = brand.websiteUrl?.trim();
  if (site) return `${site.replace(/\/$/, "")}/email/social`;
  return null;
}
