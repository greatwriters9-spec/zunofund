"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { browserAuthRedirectToUrl } from "@/lib/site-url";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

function ForgotPasswordInner() {
  const supabase = useSupabase();
  const searchParams = useSearchParams();
  const inboundNotice = searchParams.get("notice");

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  async function handleReset() {
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setSendError("Enter a valid email address.");
      return;
    }

    setSendError(null);
    setLoading(true);

    /**
     * Must run in the browser Supabase client (`flowType: "implicit"` in `createBrowserClient`).
     * Server-side `resetPasswordForEmail` defaults to PKCE and embeds a code_challenge; the email
     * is then opened on another device (mail app) with no code_verifier → exchange fails and users
     * never reach `/reset-password`. Signup already uses the browser client for the same reason.
     */
    /** Prefer live browser origin so `redirectTo` matches Supabase allow-list for this host. */
    let redirectTo = browserAuthRedirectToUrl("/reset-password");
    try {
      const r = await fetch("/api/auth/password-reset-redirect", {
        cache: "no-store",
      });
      if (r.ok) {
        const j = (await r.json()) as { redirectTo?: string };
        if (
          typeof j.redirectTo === "string" &&
          /^https?:\/\//i.test(j.redirectTo)
        ) {
          redirectTo = j.redirectTo;
        }
      }
    } catch {
      /* keep authRedirectToUrl fallback */
    }

    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      setSendError(formatSupabaseError(error));
      return;
    }

    setSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
        <h1 className="text-4xl font-bold text-yellow-500 mb-3">
          Reset Password
        </h1>

        <p className="text-zinc-400 mb-8">
          Enter your email address and we’ll send you a password reset link.
        </p>

        {inboundNotice?.trim() ? (
          <div className="mb-6 rounded-2xl border border-yellow-500/35 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100/95 leading-relaxed">
            {inboundNotice.trim()}
          </div>
        ) : null}

        {sent ? (
          <div className="bg-green-500/10 border border-green-500 text-green-400 rounded-2xl p-4 text-sm">
            If an account exists for that email, you’ll receive a reset link
            shortly. Check your inbox and spam folder.
          </div>
        ) : (
          <>
            {sendError ? (
              <div className="mb-4 rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {sendError}
              </div>
            ) : null}
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-zinc-700 rounded-2xl px-5 py-4 text-white outline-none focus:border-yellow-500 transition mb-6"
            />

            <button
              type="button"
              onClick={() => void handleReset()}
              disabled={loading}
              className="w-full bg-yellow-500 hover:bg-yellow-400 transition text-black font-bold py-4 rounded-2xl"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center px-6 text-zinc-400">
          Loading…
        </main>
      }
    >
      <ForgotPasswordInner />
    </Suspense>
  );
}
