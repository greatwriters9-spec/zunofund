"use client"

import { useState } from "react"
import { useSupabase, formatSupabaseError } from "@/lib/supabase"

export default function ResetPasswordPage() {
  const supabase = useSupabase()

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleUpdatePassword() {

    if (!password || !confirmPassword) return

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.")
      return
    }

    setFormError(null)
    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password,
    })

    setLoading(false)

    if (error) {
      setFormError(formatSupabaseError(error))
      return
    }

    setSuccess(true)
  }

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-6 relative overflow-hidden">

      {/* Glow */}
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-yellow-500/10 blur-[150px] rounded-full" />

      <div className="relative z-10 w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[36px] p-10">

        <h1 className="text-5xl font-black text-yellow-500 mb-4">
          New Password
        </h1>

        <p className="text-zinc-400 mb-10">
          Create a new secure password for your account.
        </p>

        {success ? (

          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 text-green-400">
            Password updated successfully.
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
              onClick={handleUpdatePassword}
              disabled={loading}
              className="w-full mt-8 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-2xl transition duration-300"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </>
        )}

      </div>

    </main>
  )
}