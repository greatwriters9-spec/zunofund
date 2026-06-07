import {
  recaptchaMessageForCode,
  RECAPTCHA_MESSAGES,
  type RecaptchaErrorCode,
} from "@/lib/recaptcha/messages";

export async function verifyRecaptchaOnServer(
  token: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await fetch("/api/auth/verify-recaptcha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });

    let data: { ok?: boolean; code?: RecaptchaErrorCode };
    try {
      data = (await response.json()) as { ok?: boolean; code?: RecaptchaErrorCode };
    } catch {
      return { ok: false, message: RECAPTCHA_MESSAGES.failed };
    }

    if (data.ok) {
      return { ok: true };
    }

    return {
      ok: false,
      message: recaptchaMessageForCode(data.code),
    };
  } catch {
    return { ok: false, message: RECAPTCHA_MESSAGES.failed };
  }
}
