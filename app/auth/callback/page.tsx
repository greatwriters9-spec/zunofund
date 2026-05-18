"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  SUPABASE_EMAIL_LINK_OTP_TYPES,
  supabaseAuthHashLooksLikeSession,
} from "@/lib/auth/supabaseEmailLink";
import { sanitizeNextParam } from "@/lib/authLinks";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

/** PKCE email links fail cross-browser (no code_verifier); email may already be verified server-side. */
function exchangeFailedLikelyPkceOrConsumed(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg =
    "message" in err && typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message.toLowerCase()
      : "";
  const code =
    "code" in err && typeof (err as { code: unknown }).code === "string"
      ? (err as { code: string }).code.toLowerCase()
      : "";
  return (
    msg.includes("code verifier") ||
    msg.includes("code_verifier") ||
    (msg.includes("code") && msg.includes("verifier")) ||
    msg.includes("invalid_grant") ||
    msg.includes("bad_oauth") ||
    msg.includes("bad code verifier") ||
    msg.includes("both auth code and code verifier") ||
    code === "validation_failed" ||
    code === "bad_oauth_state" ||
    code === "invalid_grant"
  );
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
      /** Let @supabase/ssr parse hash/query into cookies on first tick (race with React). */
      await new Promise((r) => setTimeout(r, 0));

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
              window.location.assign(nextPath);
              return;
            }
            if (exchangeFailedLikelyPkceOrConsumed(exErr)) {
              router.replace(
                `/auth?notice=${encodeURIComponent(
                  "Your email is verified. Sign in with your email and password.",
                )}`,
              );
              return;
            }
            const msg = formatSupabaseError(exErr).toLowerCase();
            const looksConsumed =
              msg.includes("code") &&
              (msg.includes("invalid") ||
                msg.includes("expired") ||
                msg.includes("already") ||
                msg.includes("exchange"));
            setError(
              looksConsumed
                ? "This link was already used or expired. Your email may already be verified — try signing in below."
                : formatSupabaseError(exErr),
            );
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
              window.location.assign(nextPath);
              return;
            }
            setError(formatSupabaseError(vErr));
            return;
          }
        } else if (hasFragmentTokens) {
          await new Promise((r) => setTimeout(r, 200));
        }

        ({
          data: { session },
        } = await supabase.auth.getSession());

        if (!session && hasFragmentTokens) {
          await new Promise((r) => setTimeout(r, 500));
          ({
            data: { session },
          } = await supabase.auth.getSession());
        }

        if (!session?.user) {
          if (!cancelled) {
            setError(
              "This link is invalid or has expired. Try signing in, or request a new confirmation email.",
            );
          }
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
          const { data: sess } = await supabase.auth.getSession();
          if (sess?.user) {
            window.location.assign(nextPath);
            return;
          }
          if (
            hadInboundParams &&
            (e instanceof Error
              ? exchangeFailedLikelyPkceOrConsumed({ message: e.message })
              : false)
          ) {
            router.replace(
              `/auth?notice=${encodeURIComponent(
                "Your email is verified. Sign in with your email and password.",
              )}`,
            );
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
