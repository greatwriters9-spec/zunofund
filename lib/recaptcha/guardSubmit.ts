import type { RefObject } from "react";

import type { AuthRecaptchaHandle } from "@/components/auth/AuthRecaptcha";
import { isRecaptchaSiteKeyConfigured } from "@/lib/recaptcha/config";
import { RECAPTCHA_MESSAGES } from "@/lib/recaptcha/messages";
import { verifyRecaptchaOnServer } from "@/lib/recaptcha/verifyClient";

type RecaptchaRef = RefObject<AuthRecaptchaHandle | null>;

export async function guardAuthActionWithRecaptcha(
  recaptchaRef: RecaptchaRef,
  setRecaptchaError: (message: string | null) => void,
  action: () => void | Promise<void>,
): Promise<void> {
  setRecaptchaError(null);

  if (!isRecaptchaSiteKeyConfigured()) {
    setRecaptchaError(RECAPTCHA_MESSAGES.notConfigured);
    return;
  }

  const token = recaptchaRef.current?.getToken();
  if (!token) {
    setRecaptchaError(RECAPTCHA_MESSAGES.incomplete);
    return;
  }

  const verification = await verifyRecaptchaOnServer(token);
  if (!verification.ok) {
    setRecaptchaError(verification.message);
    recaptchaRef.current?.reset();
    return;
  }

  try {
    await action();
  } finally {
    recaptchaRef.current?.reset();
  }
}
