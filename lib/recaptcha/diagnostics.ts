const DEV = process.env.NODE_ENV === "development";

export type RecaptchaDiagnosticEvent =
  | "init_start"
  | "site_key_check"
  | "script_load_ok"
  | "script_load_fail"
  | "grecaptcha_ready"
  | "grecaptcha_missing"
  | "visibility_wait"
  | "visibility_timeout"
  | "render_ok"
  | "render_fail"
  | "skipped_inactive";

export function logRecaptchaDiagnostic(
  event: RecaptchaDiagnosticEvent,
  detail?: Record<string, unknown>,
): void {
  if (!DEV) return;
  console.info(`[recaptcha] ${event}`, detail ?? {});
}

export function maskSiteKey(siteKey: string | undefined): string {
  if (!siteKey) return "(missing)";
  if (siteKey.length <= 8) return `${siteKey.slice(0, 2)}…`;
  return `${siteKey.slice(0, 6)}…${siteKey.slice(-4)}`;
}

export function detectRecaptchaKeyType(siteKey: string | undefined): string {
  if (!siteKey) return "missing";
  if (siteKey.startsWith("6L")) return "v2-checkbox (expected)";
  if (siteKey.startsWith("6Le")) return "v2-invisible (may fail in checkbox widget)";
  if (siteKey.startsWith("6Lc")) return "v3/score (incompatible with checkbox widget)";
  return "unknown format";
}

export function isRecaptchaContainerVisible(el: HTMLElement | null): boolean {
  if (!el || !el.isConnected) return false;

  let node: HTMLElement | null = el;
  while (node) {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
    node = node.parentElement;
  }

  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export async function waitForRecaptchaContainerVisible(
  getEl: () => HTMLElement | null,
  timeoutMs = 5000,
): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const el = getEl();
    if (el && isRecaptchaContainerVisible(el)) return true;
    await new Promise((r) => window.requestAnimationFrame(r));
  }
  return false;
}
