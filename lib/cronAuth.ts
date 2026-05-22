/** True when the request is from Vercel Cron (not a public browser hit). */
export function isVercelCronRequest(request: Request): boolean {
  if (request.headers.get("x-vercel-cron")) return true;

  const ua = request.headers.get("user-agent") ?? "";
  if (ua.includes("vercel-cron")) return true;

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return true;
  }

  return false;
}
