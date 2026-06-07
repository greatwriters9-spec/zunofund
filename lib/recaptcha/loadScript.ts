import { logRecaptchaDiagnostic } from "@/lib/recaptcha/diagnostics";

const RECAPTCHA_SCRIPT_SRC = "https://www.google.com/recaptcha/api.js?render=explicit";
const RECAPTCHA_SCRIPT_MARKER = "recaptcha/api.js";

type GrecaptchaReady = {
  ready: (callback: () => void) => void;
};

declare global {
  interface Window {
    grecaptcha?: GrecaptchaReady;
  }
}

let loadPromise: Promise<void> | null = null;

function isScriptAlreadyLoaded(script: HTMLScriptElement): boolean {
  return (
    script.dataset.loaded === "true" ||
    script.getAttribute("data-loaded") === "true" ||
    script.readyState === "complete" ||
    script.readyState === "loaded"
  );
}

function waitForGrecaptcha(timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();

    const tick = () => {
      if (typeof window === "undefined") {
        reject(new Error("recaptcha unavailable"));
        return;
      }

      if (window.grecaptcha) {
        window.grecaptcha.ready(() => {
          logRecaptchaDiagnostic("grecaptcha_ready");
          resolve();
        });
        return;
      }

      if (Date.now() - started >= timeoutMs) {
        logRecaptchaDiagnostic("grecaptcha_missing", { reason: "timeout" });
        reject(new Error("recaptcha load timeout"));
        return;
      }

      window.setTimeout(tick, 50);
    };

    tick();
  });
}

function findExistingRecaptchaScript(): HTMLScriptElement | null {
  return document.querySelector<HTMLScriptElement>(`script[src*="${RECAPTCHA_SCRIPT_MARKER}"]`);
}

function injectRecaptchaScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("recaptcha unavailable"));
      return;
    }

    const existing = findExistingRecaptchaScript();

    if (existing) {
      if (isScriptAlreadyLoaded(existing) || window.grecaptcha) {
        existing.dataset.loaded = "true";
      } else {
        existing.addEventListener(
          "load",
          () => {
            existing.dataset.loaded = "true";
          },
          { once: true },
        );
        existing.addEventListener(
          "error",
          () => reject(new Error("recaptcha script error")),
          { once: true },
        );
      }

      void waitForGrecaptcha().then(resolve).catch(reject);
      return;
    }

    const script = document.createElement("script");
    script.src = RECAPTCHA_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.recaptchaLoader = "true";

    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      void waitForGrecaptcha().then(resolve).catch(reject);
    });
    script.addEventListener("error", () => reject(new Error("recaptcha script error")));

    document.head.appendChild(script);
  });
}

/** Load Google reCAPTCHA v2 explicit API once; safe across client navigations. */
export function loadRecaptchaScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("recaptcha unavailable"));
  }

  if (window.grecaptcha) {
    return new Promise((resolve, reject) => {
      let settled = false;
      window.grecaptcha!.ready(() => {
        if (!settled) {
          settled = true;
          logRecaptchaDiagnostic("grecaptcha_ready", { source: "already_loaded" });
          resolve();
        }
      });
      window.setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error("recaptcha ready timeout"));
        }
      }, 15000);
    });
  }

  if (!loadPromise) {
    loadPromise = injectRecaptchaScript()
      .then(() => {
        logRecaptchaDiagnostic("script_load_ok");
      })
      .catch((err) => {
        loadPromise = null;
        logRecaptchaDiagnostic("script_load_fail", {
          message: err instanceof Error ? err.message : String(err),
        });
        throw err;
      });
  }

  return loadPromise;
}

/** Clear loader state so a failed load can be retried. */
export function resetRecaptchaScriptLoader(): void {
  loadPromise = null;

  if (typeof document === "undefined") return;

  document
    .querySelectorAll<HTMLScriptElement>('script[data-recaptcha-loader="true"]')
    .forEach((node) => node.remove());

  if (typeof window !== "undefined") {
    delete window.grecaptcha;
  }
}
