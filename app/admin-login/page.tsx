"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabase, formatSupabaseError } from "@/lib/supabase";

export default function AdminLoginPage() {
  const supabase = useSupabase();

  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    const { data: admin, error: adminError } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(); // safe

    if (adminError) {
      setErrorMessage(formatSupabaseError(adminError));
      setLoading(false);
      return;
    }

    if (!admin) {
      setErrorMessage("Unauthorized access");

      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    // SUCCESS
    router.push("/admin");
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
        <h1 className="text-4xl font-bold text-yellow-500 mb-2">
          Admin Login
        </h1>

        <p className="text-zinc-500 mb-8">
          Secure administrator access
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