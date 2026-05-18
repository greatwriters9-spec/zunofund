"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  SUPABASE_EMAIL_LINK_OTP_TYPES,
  supabaseAuthHashLooksLikeSession,
} from "@/lib/auth/supabaseEmailLink";
import { sanitizeNextParam } from "@/lib/authLinks";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

function AuthCallbackInner() {
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const nextPath =
        sanitizeNextParam(searchParams.get("next")) ?? "/dashboard";

      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type") ?? "";
      const hash =
        typeof window !== "undefined" ? window.location.hash.slice(1) : "";
      const hasFragmentTokens = supabaseAuthHashLooksLikeSession(hash);
      const hadInboundParams =
        Boolean(code) ||
        Boolean(tokenHash && SUPABASE_EMAIL_LINK_OTP_TYPES.has(type)) ||
        hasFragmentTokens;

      if (!hadInboundParams) {
        router.replace("/auth?error=missing_code");
        return;
      }

      try {
        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(
            code,
          );
          if (exErr) {
            if (!cancelled) setError(formatSupabaseError(exErr));
            return;
          }
        } else if (tokenHash && SUPABASE_EMAIL_LINK_OTP_TYPES.has(type)) {
          const { error: vErr } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as "recovery" | "email" | "signup" | "email_change",
          });
          if (vErr) {
            if (!cancelled) setError(formatSupabaseError(vErr));
            return;
          }
        } else if (hasFragmentTokens) {
          await new Promise((r) => setTimeout(r, 150));
        }

        let {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session && hasFragmentTokens) {
          await new Promise((r) => setTimeout(r, 400));
          ({
            data: { session },
          } = await supabase.auth.getSession());
        }

        if (!session) {
          if (!cancelled) {
            setError(
              "This link is invalid or has expired. Try signing in again or request a new confirmation email.",
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
