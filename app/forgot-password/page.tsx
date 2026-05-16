"use client"

import { useState } from "react"
import { useSupabase, formatSupabaseError } from "@/lib/supabase"

export default function ForgotPasswordPage() {
  const supabase = useSupabase()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  async function handleReset() {
    if (!email) return

    setSendError(null)
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:3000/reset-password",
    })

    setLoading(false)

    if (error) {
      setSendError(formatSupabaseError(error))
      return
    }

    setSent(true)
  }

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
        <h1 className="text-4xl font-bold text-yellow-500 mb-3">
          Reset Password
        </h1>

        <p className="text-zinc-400 mb-8">
          Enter your email address and we’ll send you a password reset link.
        </p>

        {sent ? (
          <div className="bg-green-500/10 border border-green-500 text-green-400 rounded-2xl p-4 text-sm">
            Password reset email sent successfully.
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
              onClick={handleReset}
              disabled={loading}
              className="w-full bg-yellow-500 hover:bg-yellow-400 transition text-black font-bold py-4 rounded-2xl"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </>
        )}
      </div>
    </main>
  )
}