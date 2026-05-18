import {
  getEmailBrandConfig,
  type EmailBrandConfig,
} from "@/lib/email/brand";
import { DEFAULT_STAY_CONNECTED_LINKS } from "@/lib/email/default-stay-connected-links";
import {
  absoluteSocialIconUrl,
  resolveSocialIconBase,
  socialIconSlugForLink,
} from "@/lib/email/social-icons";

export type ZunoEmailVariant = "investor" | "admin";

/** Binance-style accent (gold); buttons use a deeper gold for contrast. */
const GOLD = "#f0b90b";
const GOLD_DARK = "#a16207";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function goldLink(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="color:${GOLD};text-decoration:none;font-weight:600">${escapeHtml(label)}</a>`;
}

function paragraphsFromBody(bodyText: string): string {
  const chunks = bodyText
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (chunks.length === 0) {
    return `<p style="color:#e5e5e5;margin:0 0 18px;font-size:15px;line-height:1.65;font-family:system-ui,Segoe UI,Roboto,Helvetica,sans-serif">&#8212;</p>`;
  }
  return chunks
    .map(
      (chunk) =>
        `<p style="color:#e5e5e5;margin:0 0 18px;font-size:15px;line-height:1.65;font-family:system-ui,Segoe UI,Roboto,Helvetica,sans-serif">${escapeHtml(chunk)}</p>`,
    )
    .join("");
}

function primaryCta(href: string, label: string): string {
  const h = escapeHtml(href);
  const l = escapeHtml(label);
  return `
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:28px auto 0;border-collapse:collapse">
  <tr>
    <td align="center" bgcolor="${GOLD_DARK}" style="border-radius:8px;background-color:${GOLD_DARK};mso-padding-alt:14px 36px">
      <a href="${h}" style="display:inline-block;padding:14px 36px;font-family:system-ui,Segoe UI,Roboto,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;line-height:1.2">${l}</a>
    </td>
  </tr>
</table>`;
}

function securityBlock(brand: EmailBrandConfig): string {
  const support =
    brand.supportEmail !== null
      ? goldLink(`mailto:${brand.supportEmail}`, "customer support")
      : null;

  const reset =
    brand.passwordResetUrl !== null
      ? goldLink(brand.passwordResetUrl, "reset your password")
      : null;

  let sentence: string;
  if (reset && support) {
    sentence = `Don&#8217;t recognize this activity? Please ${reset} and contact ${support} immediately.`;
  } else if (support) {
    sentence = `Don&#8217;t recognize this activity? Please contact ${support} immediately.`;
  } else if (reset) {
    sentence = `Don&#8217;t recognize this activity? Please ${reset} immediately.`;
  } else {
    sentence =
      "Don&#8217;t recognize this activity? Sign in to your account and secure your credentials immediately.";
  }

  return `
<p style="margin:28px 0 0;font-size:13px;line-height:1.65;color:#a3a3a3;font-family:system-ui,Segoe UI,Roboto,Helvetica,sans-serif">
  ${sentence}
</p>
<p style="margin:14px 0 0;font-size:12px;line-height:1.55;color:#737373;font-family:system-ui,Segoe UI,Roboto,Helvetica,sans-serif;font-style:italic">
  *This is an automated message, please do not reply.*
</p>`;
}

function stayConnectedSection(brand: EmailBrandConfig): string {
  const items: { label: string; url: string }[] =
    brand.socialLinks.length > 0
      ? [...brand.socialLinks]
      : [...DEFAULT_STAY_CONNECTED_LINKS];

  if (brand.websiteUrl) {
    const w = brand.websiteUrl.trim();
    const seen = new Set(items.map((i) => i.url));
    if (!seen.has(w)) {
      items.push({ label: brand.brandName, url: w });
    }
  }

  if (items.length === 0) {
    return "";
  }

  const iconBase = resolveSocialIconBase(brand);

  const cells = items.map((item) => {
    const href = escapeHtml(item.url.trim());
    const labelSafe = escapeHtml(item.label);

    const slug =
      brand.socialLinkStyle === "icons" && iconBase !== null
        ? socialIconSlugForLink({
            label: item.label,
            url: item.url,
            websiteUrl: brand.websiteUrl,
          })
        : null;

    if (brand.socialLinkStyle === "icons" && iconBase !== null && slug !== null) {
      const src = escapeHtml(absoluteSocialIconUrl(iconBase, slug));
      return `<td style="padding:0 12px;vertical-align:middle"><a href="${href}" style="display:inline-block;line-height:0;text-decoration:none" target="_blank" rel="noopener noreferrer"><img src="${src}" width="24" height="24" alt="${labelSafe}" style="display:block;border:0;width:24px;height:24px;opacity:0.92" /></a></td>`;
    }

    return `<td style="padding:0 12px;vertical-align:middle;text-align:center"><a href="${href}" style="color:${GOLD};text-decoration:none;font-size:13px;font-weight:600;font-family:system-ui,Segoe UI,Roboto,Helvetica,sans-serif" target="_blank" rel="noopener noreferrer">${labelSafe}</a></td>`;
  });

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-collapse:collapse;border-top:1px solid #2a2a2a">
  <tr>
    <td style="padding:22px 0 6px">
      <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:${GOLD};letter-spacing:0.04em;font-family:system-ui,Segoe UI,Roboto,Helvetica,sans-serif;text-align:center">
        Stay connected!
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;border-collapse:collapse">
        <tr>
          ${cells.join("")}
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function footerContactGrid(brand: EmailBrandConfig): string {
  const blocks: string[] = [];

  if (brand.supportEmail) {
    blocks.push(
      `<p style="margin:8px 0 0;color:#737373;font-size:12px;line-height:1.6;font-family:system-ui,Segoe UI,Roboto,Helvetica,sans-serif">${goldLink(`mailto:${brand.supportEmail}`, brand.supportEmail)}</p>`,
    );
  }
  if (brand.supportPhone) {
    blocks.push(
      `<p style="margin:6px 0 0;color:#a3a3a3;font-size:12px;font-family:system-ui,Segoe UI,Roboto,Helvetica,sans-serif">${escapeHtml(brand.supportPhone)}</p>`,
    );
  }
  for (const line of brand.companyAddressLines) {
    blocks.push(
      `<p style="margin:6px 0 0;color:#737373;font-size:11px;line-height:1.5;font-family:system-ui,Segoe UI,Roboto,Helvetica,sans-serif">${escapeHtml(line)}</p>`,
    );
  }

  if (blocks.length === 0) return "";

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:collapse">
  <tr>
    <td style="padding-top:8px;text-align:center">
      ${blocks.join("")}
    </td>
  </tr>
</table>`;
}

function headerLogoBar(brand: EmailBrandConfig): string {
  const logoUrl = brand.logoUrl?.trim();
  const name = escapeHtml(brand.brandName);

  const inner = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${name}" height="32" style="display:block;margin:0 auto;max-height:32px;width:auto;border:0" />`
    : `<p style="margin:0;font-size:19px;font-weight:800;color:#fafafa;letter-spacing:0.14em;text-align:center;font-family:system-ui,Segoe UI,Roboto,Helvetica,sans-serif">${name}</p>`;

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e1e1e;border-collapse:collapse;border-bottom:3px solid ${GOLD}">
  <tr>
    <td style="padding:20px 24px;text-align:center">
      ${inner}
    </td>
  </tr>
</table>`;
}

/** Gold eyebrow inside the body column — survives clients that clip the top header table. */
function brandEyebrow(brand: EmailBrandConfig, variant: ZunoEmailVariant): string {
  const label =
    variant === "admin" ? `${brand.brandName} Admin` : brand.brandName;
  const safe = escapeHtml(label);
  return `<p style="margin:0 0 14px;font-size:11px;font-weight:700;color:${GOLD};letter-spacing:0.22em;text-transform:uppercase;font-family:system-ui,Segoe UI,Roboto,Helvetica,sans-serif">${safe}</p>`;
}

/**
 * Full transactional HTML (inline styles) — dark header bar, gold accents, primary CTA (exchange-style).
 */
export function buildZunoEmailHtml(opts: {
  variant: ZunoEmailVariant;
  title: string;
  /** Main copy; blank lines become separate paragraphs. Escaped. */
  bodyText: string;
  /** Optional muted line below the body (escaped). */
  footnoteText?: string;
  brand?: EmailBrandConfig;
}): string {
  const brand = opts.brand ?? getEmailBrandConfig();
  const titleSafe = escapeHtml(opts.title);

  const ctaHref =
    opts.variant === "admin" ? brand.adminDeskUrl : brand.dashboardUrl;
  const ctaLabel =
    opts.variant === "admin" ? "Open admin desk" : "Visit your dashboard";

  const ctaHtml =
    ctaHref !== null && ctaHref.length > 0
      ? primaryCta(ctaHref, ctaLabel)
      : "";

  const footnote =
    opts.footnoteText && opts.footnoteText.trim().length > 0
      ? `<p style="color:#a3a3a3;font-size:13px;margin:18px 0 0;line-height:1.6;font-family:system-ui,Segoe UI,Roboto,Helvetica,sans-serif">${escapeHtml(opts.footnoteText.trim())}</p>`
      : "";

  const tagline =
    brand.footerTagline && brand.footerTagline.trim().length > 0
      ? `<p style="color:#525252;font-size:11px;margin:14px 0 0;line-height:1.55;text-align:center;font-family:system-ui,Segoe UI,Roboto,Helvetica,sans-serif">${escapeHtml(brand.footerTagline.trim())}</p>`
      : "";

  const connected = stayConnectedSection(brand);
  const contacts = footerContactGrid(brand);

  const teamLine = `<p style="margin:18px 0 0;text-align:center;font-size:12px;color:#737373;font-family:system-ui,Segoe UI,Roboto,Helvetica,sans-serif">&#8212; The ${escapeHtml(brand.brandName)} Team</p>`;

  const preheader = `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;font-family:system-ui,Segoe UI,Roboto,Helvetica,sans-serif;color:#121212;">${escapeHtml(brand.brandName)} &#8212; ${titleSafe}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${titleSafe}</title>
</head>
<body style="margin:0;padding:0;background:#121212;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#121212;padding:24px 12px;border-collapse:collapse">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a;background:#161616">
          <tr>
            <td style="padding:0">
              ${headerLogoBar(brand)}
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 28px;font-family:system-ui,Segoe UI,Roboto,Helvetica,sans-serif">
              ${brandEyebrow(brand, opts.variant)}
              <h1 style="color:#ffffff;margin:0 0 20px;font-size:24px;font-weight:700;line-height:1.3;letter-spacing:-0.02em">${titleSafe}</h1>
              ${paragraphsFromBody(opts.bodyText)}
              ${footnote}
              ${ctaHtml}
              ${securityBlock(brand)}
              ${teamLine}
              ${connected}
              ${contacts}
              ${tagline}
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border-collapse:collapse">
          <tr>
            <td style="padding:18px 16px 8px;text-align:center">
              <p style="color:#525252;font-size:11px;margin:0;line-height:1.55;font-family:system-ui,Segoe UI,Roboto,Helvetica,sans-serif">You received this email because you have an account with ${escapeHtml(brand.brandName)}.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
