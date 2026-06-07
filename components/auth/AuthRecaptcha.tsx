"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { isRecaptchaSiteKeyConfigured } from "@/lib/recaptcha/config";
import {
  detectRecaptchaKeyType,
  logRecaptchaDiagnostic,
  maskSiteKey,
  waitForRecaptchaContainerVisible,
} from "@/lib/recaptcha/diagnostics";
import { loadRecaptchaScript, resetRecaptchaScriptLoader } from "@/lib/recaptcha/loadScript";
import { RECAPTCHA_MESSAGES } from "@/lib/recaptcha/messages";

export type AuthRecaptchaHandle = {
  getToken: () => string | null;
  reset: () => void;
};

type AuthRecaptchaProps = {
  theme?: "light" | "dark";
  onExpire?: () => void;
  className?: string;
  /** When false, skip init (used to avoid duplicate mobile+desktop instances). */
  active?: boolean;
};

type LoadState = "idle" | "loading" | "ready" | "error";

const IS_DEV = process.env.NODE_ENV === "development";

export const AuthRecaptcha = forwardRef<AuthRecaptchaHandle, AuthRecaptchaProps>(
  function AuthRecaptcha(
    { theme = "light", onExpire, className = "", active = true },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<number | null>(null);
    const onExpireRef = useRef(onExpire);
    const mountGenerationRef = useRef(0);
    const [loadState, setLoadState] = useState<LoadState>("idle");
    const [initError, setInitError] = useState<string | null>(null);
    const [retryNonce, setRetryNonce] = useState(0);
    const instanceId = useId();
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
    const configured = isRecaptchaSiteKeyConfigured();

    useEffect(() => {
      onExpireRef.current = onExpire;
    }, [onExpire]);

    const cleanupWidget = useCallback(() => {
      if (widgetIdRef.current !== null && window.grecaptcha) {
        try {
          window.grecaptcha.reset(widgetIdRef.current);
        } catch {
          /* widget may already be gone */
        }
      }
      widgetIdRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    }, []);

    const renderWidget = useCallback((): number | null => {
      if (!siteKey || !containerRef.current || !window.grecaptcha) {
        return null;
      }

      cleanupWidget();

      try {
        const widgetId = window.grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          "expired-callback": () => onExpireRef.current?.(),
          "error-callback": () => onExpireRef.current?.(),
        });
        widgetIdRef.current = widgetId;
        logRecaptchaDiagnostic("render_ok", { widgetId });
        return widgetId;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logRecaptchaDiagnostic("render_fail", { message });
        return null;
      }
    }, [siteKey, theme, cleanupWidget]);

    useEffect(() => {
      if (!configured || !siteKey || !active) {
        if (!active) {
          logRecaptchaDiagnostic("skipped_inactive");
        }
        return;
      }

      const generation = ++mountGenerationRef.current;
      let cancelled = false;

      setLoadState("loading");
      setInitError(null);

      logRecaptchaDiagnostic("init_start", {
        siteKey: maskSiteKey(siteKey),
        keyType: detectRecaptchaKeyType(siteKey),
        version: "v2-checkbox-explicit",
        active,
      });

      logRecaptchaDiagnostic("site_key_check", {
        present: Boolean(siteKey),
        keyType: detectRecaptchaKeyType(siteKey),
      });

      void (async () => {
        try {
          await loadRecaptchaScript();
          if (cancelled || generation !== mountGenerationRef.current) return;

          logRecaptchaDiagnostic("visibility_wait");
          const visible = await waitForRecaptchaContainerVisible(
            () => containerRef.current,
            5000,
          );
          if (!visible) {
            logRecaptchaDiagnostic("visibility_timeout");
            throw new Error("reCAPTCHA container is not visible");
          }

          const widgetId = renderWidget();
          if (widgetId === null) {
            throw new Error("grecaptcha.render failed");
          }

          if (!cancelled && generation === mountGenerationRef.current) {
            setLoadState("ready");
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (!cancelled && generation === mountGenerationRef.current) {
            setInitError(message);
            setLoadState("error");
          }
        }
      })();

      return () => {
        cancelled = true;
        cleanupWidget();
      };
    }, [configured, siteKey, active, renderWidget, cleanupWidget, retryNonce]);

    useImperativeHandle(ref, () => ({
      getToken: () => {
        if (widgetIdRef.current === null || !window.grecaptcha) return null;
        const token = window.grecaptcha.getResponse(widgetIdRef.current);
        return token || null;
      },
      reset: () => {
        if (widgetIdRef.current !== null && window.grecaptcha) {
          window.grecaptcha.reset(widgetIdRef.current);
        }
      },
    }));

    function handleRetry() {
      resetRecaptchaScriptLoader();
      cleanupWidget();
      setInitError(null);
      setLoadState("loading");
      setRetryNonce((n) => n + 1);
    }

    if (!configured || !siteKey) {
      return (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900"
          role="status"
        >
          {RECAPTCHA_MESSAGES.notConfigured}
        </p>
      );
    }

    if (!active) {
      return null;
    }

    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        {loadState === "loading" ? (
          <p className="text-center text-sm text-zinc-500" role="status" aria-live="polite">
            {RECAPTCHA_MESSAGES.loading}
          </p>
        ) : null}

        {loadState === "error" ? (
          <div className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center">
            <p className="text-sm text-red-700" role="alert">
              {RECAPTCHA_MESSAGES.loadFailed}
            </p>
            {IS_DEV && initError ? (
              <p className="mt-2 break-words font-mono text-[11px] text-red-600">{initError}</p>
            ) : null}
            <button
              type="button"
              onClick={handleRetry}
              className="mt-2 text-sm font-semibold text-red-800 underline-offset-2 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : null}

        <div
          ref={containerRef}
          id={`recaptcha-${instanceId.replace(/:/g, "")}`}
          className="flex min-h-[78px] w-full justify-center overflow-hidden"
        />
      </div>
    );
  },
);
