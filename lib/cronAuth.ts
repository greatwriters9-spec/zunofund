export type CronAuthDebug = {
  userAgent: string | null;
  hasXVercelCron: boolean;
  hasAuthorization: boolean;
  hasCronSecretEnv: boolean;
  userAgentMatch: boolean;
};

/** Inspect headers (safe to log — no secrets). */
export function cronAuthDebug(request: Request): CronAuthDebug {
  const ua = request.headers.get("user-agent");
  return {
    userAgent: ua,
    hasXVercelCron: Boolean(request.headers.get("x-vercel-cron")),
    hasAuthorization: Boolean(request.headers.get("authorization")),
    hasCronSecretEnv: Boolean(process.env.CRON_SECRET?.trim()),
    userAgentMatch: /vercel-cron/i.test(ua ?? ""),
  };
}

/**
 * True when the request is from Vercel Cron.
 * Vercel docs: User-Agent `vercel-cron/1.0`; with CRON_SECRET set, also sends Authorization Bearer.
 */
export function isVercelCronRequest(request: Request): boolean {
  if (request.headers.get("x-vercel-cron")) return true;

  const ua = request.headers.get("user-agent") ?? "";
  if (/vercel-cron/i.test(ua)) return true;

  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization")?.trim() ?? "";
    if (auth === `Bearer ${secret}`) return true;
  }

  return false;
}
