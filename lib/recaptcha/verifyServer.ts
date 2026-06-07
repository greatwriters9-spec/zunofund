import type { RecaptchaErrorCode } from "@/lib/recaptcha/messages";

type VerifyResult =
  | { ok: true }
  | { ok: false; code: RecaptchaErrorCode };

export async function verifyRecaptchaToken(token: string): Promise<VerifyResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY?.trim();
  if (!secret) {
    console.error("[recaptcha] RECAPTCHA_SECRET_KEY is not configured");
    return { ok: false, code: "failed" };
  }

  const trimmed = token.trim();
  if (!trimmed) {
    return { ok: false, code: "incomplete" };
  }

  try {
    const params = new URLSearchParams();
    params.set("secret", secret);
    params.set("response", trimmed);

    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      cache: "no-store",
    });

    if (!response.ok) {
      return { ok: false, code: "failed" };
    }

    const data = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    if (data.success) {
      return { ok: true };
    }

    const codes = data["error-codes"] ?? [];
    if (codes.includes("timeout-or-duplicate")) {
      return { ok: false, code: "expired" };
    }
    if (codes.includes("missing-input-response")) {
      return { ok: false, code: "incomplete" };
    }

    return { ok: false, code: "failed" };
  } catch (error) {
    console.error("[recaptcha] siteverify request failed", error);
    return { ok: false, code: "failed" };
  }
}
