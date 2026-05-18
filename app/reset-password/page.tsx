"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  SUPABASE_EMAIL_LINK_OTP_TYPES,
  supabaseAuthHashLooksLikeSession,
} from "@/lib/auth/supabaseEmailLink";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

/** Shown when PKCE / in-app browsers break the exchange even though the link can work in Safari or Chrome. */
const OPEN_IN_BROWSER_NOTICE =
  "If you tapped this link inside WhatsApp or another in-app browser, open it in Safari or Chrome instead—or copy the link into your browser. You can always request a fresh reset email from the sign-in page.";

function ResetPasswordInner() {
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /** Finished consuming email link params (or confirmed no link was required). */
  const [authGate, setAuthGate] = useState<"pending" | "ready" | "error">(
    "pending",
  );
  const [authGateError, setAuthGateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function establishSessionFromEmailLink() {
      await new Promise((r) => setTimeout(r, 80));

      const browserUrl =
        typeof window !== "undefined"
          ? new URL(window.location.href)
          : null;

      const code =
        browserUrl?.searchParams.get("code") ?? searchParams.get("code");
      const tokenHash =
        browserUrl?.searchParams.get("token_hash") ??
        searchParams.get("token_hash");
      const type =
        browserUrl?.searchParams.get("type") ??
        searchParams.get("type") ??
        "";
      const hash = browserUrl?.hash.slice(1) ?? "";
      const hasFragmentTokens = supabaseAuthHashLooksLikeSession(hash);
      const hadInboundParams =
        Boolean(code) ||
        Boolean(tokenHash && SUPABASE_EMAIL_LINK_OTP_TYPES.has(type)) ||
        hasFragmentTokens;

      try {
        if (code) {
          const { error: exErr } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exErr) {
            const {
              data: { session: recovered },
            } = await supabase.auth.getSession();
            if (!recovered?.user && !cancelled) {
              const detail =
                exErr.message?.trim() ||
                "We could not verify your reset link.";
              setAuthGateError(`${detail} ${OPEN_IN_BROWSER_NOTICE}`);
              setAuthGate("error");
            }
            if (!recovered?.user) {
              return;
            }
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
          if (vErr) {
            const {
              data: { session: recovered },
            } = await supabase.auth.getSession();
            if (!recovered?.user && !cancelled) {
              const detail =
                vErr.message?.trim() ||
                "We could not verify your reset link.";
              setAuthGateError(`${detail} ${OPEN_IN_BROWSER_NOTICE}`);
              setAuthGate("error");
            }
            if (!recovered?.user) {
              return;
            }
          }
        } else if (hasFragmentTokens) {
          await new Promise((r) => setTimeout(r, 250));
        }

        let {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session && hasFragmentTokens) {
          await new Promise((r) => setTimeout(r, 700));
          ({
            data: { session },
          } = await supabase.auth.getSession());
        }

        if (!session) {
          const {
            data: { session: retry },
          } = await supabase.auth.getSession();
          session = retry;
        }

        if (!session) {
          if (hadInboundParams && !cancelled) {
            setAuthGateError(
              `This reset link is invalid or has expired. Request a new password reset. ${OPEN_IN_BROWSER_NOTICE}`,
            );
            setAuthGate("error");
          } else if (!cancelled) {
            setAuthGateError(
              `Sign in or open the password-reset link from your email. ${OPEN_IN_BROWSER_NOTICE}`,
            );
            setAuthGate("error");
          }
          return;
        }

        if (hadInboundParams && typeof window !== "undefined") {
          window.history.replaceState(null, "", "/reset-password");
          router.replace("/reset-password");
        }

        if (!cancelled) setAuthGate("ready");
      } catch (e) {
        if (!cancelled) {
          const {
            data: { session: recovered },
          } = await supabase.auth.getSession();
          if (recovered?.user) {
            if (!cancelled) setAuthGate("ready");
            return;
          }
          setAuthGateError(
            e instanceof Error
              ? `${e.message} ${OPEN_IN_BROWSER_NOTICE}`
              : `Something went wrong. ${OPEN_IN_BROWSER_NOTICE}`,
          );
          setAuthGate("error");
        }
      }
    }

    void establishSessionFromEmailLink();
    return () => {
      cancelled = true;
    };
  }, [searchParams, supabase, router]);

  async function handleUpdatePassword() {
    if (!password || !confirmPassword) return;

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setFormError(null);
    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setFormError(formatSupabaseError(error));
      return;
    }

    setSuccess(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-yellow-500/10 blur-[150px] rounded-full" />

      <div className="relative z-10 w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[36px] p-10">
        <h1 className="text-5xl font-black text-yellow-500 mb-4">
          New Password
        </h1>

        <p className="text-zinc-400 mb-10">
          Create a new secure password for your account.
        </p>

        {authGate === "pending" ? (
          <div className="rounded-2xl border border-zinc-800 bg-black/40 px-5 py-4 text-sm text-zinc-400">
            Verifying your reset link…
          </div>
        ) : authGate === "error" ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-red-500/60 bg-red-500/10 px-5 py-4 text-sm text-red-300">
              {authGateError ??
                "We could not verify your reset link. Request a new email."}
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <a
                href="/forgot-password"
                className="font-semibold text-yellow-500 hover:text-yellow-400 transition"
              >
                Request a new reset email
              </a>
              <a
                href="/auth"
                className="text-zinc-500 hover:text-zinc-400 transition"
              >
                Back to sign in
              </a>
            </div>
          </div>
        ) : success ? (
          <div className="space-y-5">
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 text-green-400">
              Password updated successfully.
            </div>
            <a
              href="/auth"
              className="inline-block text-sm font-semibold text-yellow-500 hover:text-yellow-400 transition"
            >
              Continue to sign in
            </a>
          </div>
        ) : (
          <>
            {formError ? (
              <div className="mb-6 rounded-2xl border border-red-500/60 bg-red-500/10 px-5 py-4 text-red-300 text-sm">
                {formError}
              </div>
            ) : null}
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-zinc-400 mb-3">
                  New Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-2xl px-5 py-4 text-white outline-none focus:border-yellow-500 transition"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-3">
                  Confirm Password
                </label>

                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-2xl px-5 py-4 text-white outline-none focus:border-yellow-500 transition"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleUpdatePassword()}
              disabled={loading}
              className="w-full mt-8 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-2xl transition duration-300"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center px-6 text-zinc-400">
          Loading…
        </main>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
