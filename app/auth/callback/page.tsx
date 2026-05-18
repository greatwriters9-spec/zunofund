"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  SUPABASE_EMAIL_LINK_OTP_TYPES,
  authRedirectLooksLikePasswordRecovery,
  supabaseAuthHashLooksLikeSession,
} from "@/lib/auth/supabaseEmailLink";
import { sanitizeNextParam } from "@/lib/authLinks";
import { useSupabase } from "@/lib/supabase";

/** When exchange fails (PKCE / in-app browser / cookies), verification often already succeeded server-side. */
const SIGN_IN_NOTICE =
  "Your email is usually verified already — especially if you opened this link inside WhatsApp or another app. Sign in with your email and password. If that fails, open the same link in Safari or Chrome, or request a new confirmation email.";

const PASSWORD_RESET_CALLBACK_NOTICE =
  "We couldn’t finish opening your reset link from this app — try opening the same email link in Safari or Chrome, or send yourself a fresh reset email below.";

function redirectToAuthNotice(router: ReturnType<typeof useRouter>) {
  router.replace(`/auth?notice=${encodeURIComponent(SIGN_IN_NOTICE)}`);
}

function redirectToPasswordResetHelp(router: ReturnType<typeof useRouter>) {
  router.replace(
    `/forgot-password?notice=${encodeURIComponent(PASSWORD_RESET_CALLBACK_NOTICE)}`,
  );
}

function redirectAfterInboundAuthFailure(
  router: ReturnType<typeof useRouter>,
  inboundUrl: URL,
) {
  if (authRedirectLooksLikePasswordRecovery(inboundUrl)) {
    redirectToPasswordResetHelp(router);
  } else {
    redirectToAuthNotice(router);
  }
}

function parseBrowserAuthUrl(): URL | null {
  if (typeof window === "undefined") return null;
  try {
    return new URL(window.location.href);
  } catch {
    return null;
  }
}

function AuthCallbackInner() {
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      /** Extra beat for in-app browsers + @supabase/ssr parsing URL → cookies. */
      await new Promise((r) => setTimeout(r, 80));

      const browserUrl = parseBrowserAuthUrl();
      const spNext = sanitizeNextParam(searchParams.get("next"));
      const windowNext = browserUrl
        ? sanitizeNextParam(browserUrl.searchParams.get("next"))
        : null;
      const nextPath = windowNext ?? spNext ?? "/dashboard";

      const u = browserUrl ?? new URL("http://localhost/");

      const oauthErr =
        u.searchParams.get("error") ?? u.searchParams.get("error_code");
      const oauthDesc = u.searchParams.get("error_description");
      if (oauthErr) {
        const readable =
          oauthDesc?.replace(/\+/g, " ") ??
          "Sign-in was cancelled or failed. Try again.";
        router.replace(
          `/auth?error=${encodeURIComponent(readable)}`,
        );
        return;
      }

      const code =
        u.searchParams.get("code") ?? searchParams.get("code");
      const tokenHash =
        u.searchParams.get("token_hash") ??
        searchParams.get("token_hash");
      const type =
        u.searchParams.get("type") ??
        searchParams.get("type") ??
        "";
      const hash = u.hash.slice(1);

      const hasFragmentTokens = supabaseAuthHashLooksLikeSession(hash);
      const hadInboundParams =
        Boolean(code) ||
        Boolean(tokenHash && SUPABASE_EMAIL_LINK_OTP_TYPES.has(type)) ||
        hasFragmentTokens;

      let {
        data: { session },
      } = await supabase.auth.getSession();

      if (!hadInboundParams) {
        if (session?.user) {
          window.location.assign(nextPath);
          return;
        }
        router.replace("/auth?error=missing_code");
        return;
      }

      try {
        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(
            code,
          );
          if (exErr && !cancelled) {
            ({
              data: { session },
            } = await supabase.auth.getSession());
            if (session?.user) {
              if (authRedirectLooksLikePasswordRecovery(u)) {
                window.location.assign("/reset-password");
              } else {
                window.location.assign(nextPath);
              }
              return;
            }
            redirectAfterInboundAuthFailure(router, u);
            return;
          }
        } else if (tokenHash && SUPABASE_EMAIL_LINK_OTP_TYPES.has(type)) {
          const { error: vErr } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as
              | "recovery"
              | "email"
              | "signup"
              | "email_change"
              | "magiclink"
              | "invite",
          });
          if (vErr && !cancelled) {
            ({
              data: { session },
            } = await supabase.auth.getSession());
            if (session?.user) {
              if (authRedirectLooksLikePasswordRecovery(u)) {
                window.location.assign("/reset-password");
              } else {
                window.location.assign(nextPath);
              }
              return;
            }
            redirectAfterInboundAuthFailure(router, u);
            return;
          }
        } else if (hasFragmentTokens) {
          await new Promise((r) => setTimeout(r, 250));
        }

        ({
          data: { session },
        } = await supabase.auth.getSession());

        if (!session && hasFragmentTokens) {
          await new Promise((r) => setTimeout(r, 700));
          ({
            data: { session },
          } = await supabase.auth.getSession());
        }

        if (!session?.user) {
          if (!cancelled) {
            redirectAfterInboundAuthFailure(router, u);
          }
          return;
        }

        if (authRedirectLooksLikePasswordRecovery(u)) {
          window.location.assign("/reset-password");
          return;
        }

        if (typeof window !== "undefined") {
          const clean = new URL("/auth/callback", window.location.origin);
          clean.searchParams.set("next", nextPath);
          window.history.replaceState(
            null,
            "",
            `${clean.pathname}?${clean.searchParams.toString()}`,
          );
        }

        window.location.assign(nextPath);
      } catch (e) {
        if (!cancelled) {
          const {
            data: { session: recovered },
          } = await supabase.auth.getSession();
          if (recovered?.user) {
            if (authRedirectLooksLikePasswordRecovery(u)) {
              window.location.assign("/reset-password");
            } else {
              window.location.assign(nextPath);
            }
            return;
          }
          if (hadInboundParams) {
            redirectAfterInboundAuthFailure(router, u);
            return;
          }
          setError(e instanceof Error ? e.message : "Something went wrong.");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams, supabase, router]);

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-black px-6 text-center">
        <p className="max-w-md text-red-300">{error}</p>
        <a href="/auth" className="text-sm text-yellow-500 hover:text-yellow-400">
          Back to sign in
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-zinc-400">
      Completing sign-in…
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-black text-zinc-400">
          Loading…
        </main>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
