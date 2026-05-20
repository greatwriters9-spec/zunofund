"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useSupabase, formatSupabaseError } from "@/lib/supabase";

export default function AdminLoginPage() {
  const supabase = useSupabase();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("notice") === "not_admin") {
      setErrorMessage(
        "That account is signed in but is not registered as an administrator. Use an admin login, or ask your team to add your user id to the admins table in Supabase.",
      );
    }
  }, []);

  async function handleAdminLogin() {
    setErrorMessage(null);
    setLoading(true);

    // STEP 1: LOGIN
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(formatSupabaseError(error));
      setLoading(false);
      return;
    }

    // STEP 2: GET USER
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorMessage("Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    // STEP 3: CHECK ADMIN TABLE
    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin", {
      check_uid: user.id,
    });

    if (adminError) {
      setErrorMessage(formatSupabaseError(adminError));
      setLoading(false);
      return;
    }

    if (!isAdmin) {
      setErrorMessage("Unauthorized access");

      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    // Full navigation so middleware sees freshly synced session cookies (client router.push can race).
    setLoading(false);
    window.location.assign("/admin");
  }

  return (
    <main className="min-h-screen text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
        <h1 className="text-4xl font-bold text-yellow-500 mb-2">
          Admin Login
        </h1>

        <p className="text-zinc-500 mb-8">
          Secure administrator access
        </p>

        <p className="mb-6 text-center text-sm text-zinc-500">
          Investor login is separate —{" "}
          <Link href="/auth" className="text-yellow-500 hover:underline">
            Sign in as investor
          </Link>
        </p>

        {errorMessage ? (
          <div
            className="mb-6 rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            role="alert"
          >
            {errorMessage}
          </div>
        ) : null}

        <div className="space-y-5">
          <input
            type="email"
            placeholder="Admin Email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-4 outline-none focus:border-yellow-500"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-4 outline-none focus:border-yellow-500"
          />

          <button
            onClick={handleAdminLogin}
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-xl transition-all"
          >
            {loading ? "Signing In..." : "Login as Admin"}
          </button>
        </div>
      </div>
    </main>
  );
}