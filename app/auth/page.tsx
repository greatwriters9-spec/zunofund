"use client";

import { Suspense, useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { sanitizeNextParam } from "@/lib/authLinks";
import { authRedirectToUrl } from "@/lib/site-url";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

function AuthPageInner() {
  const supabase = useSupabase();
  const searchParams = useSearchParams();
  const wantsSignup = searchParams.get("signup") === "1";
  const authCallbackError = searchParams.get("error");
  const nextDestination =
    sanitizeNextParam(searchParams.get("next")) ?? "/dashboard";

  const [isLogin, setIsLogin] = useState(!wantsSignup);

  useEffect(() => {
    setIsLogin(!wantsSignup);
  }, [wantsSignup]);

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [surname, setSurname] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [errors, setErrors] = useState({
    firstName: false,
    surname: false,
    dob: false,
    phone: false,
    email: false,
    password: false,
    confirmPassword: false,
    terms: false,
  });
  const router = useRouter();

  async function handleAuth() {
    setFormError(null);
    setFormSuccess(null);
    setLoading(true);

    // LOGIN
    if (isLogin) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setFormError(formatSupabaseError(error));
        setLoading(false);
        return;
      }

      if (!data.session) {
        setFormError(
          "Your account exists, but no login session was created. If you just signed up, open the email Supabase sent and confirm your email, then try logging in again."
        );
        setLoading(false);
        return;
      }

      await supabase.auth.getSession();

      window.location.assign(nextDestination);
      return;
    }

    // VALIDATIONS
    // REQUIRED FIELD VALIDATION
const newErrors = {
  firstName: !firstName,
  surname: !surname,
  dob: !dob,
  phone: !phone,
  email: !email,
  password: !password,
  confirmPassword: !confirmPassword,
  terms: !acceptedTerms,
}

setErrors(newErrors)

if (Object.values(newErrors).some(Boolean)) {
  setLoading(false)
  return
}

if (password !== confirmPassword) {

  setErrors({
    ...newErrors,
    password: true,
    confirmPassword: true,
  })

  setLoading(false)

  return
}
setLoading(true)

    const fullName = [firstName, middleName, surname].filter(Boolean).join(" ");

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: authRedirectToUrl("/auth/callback", {
          next: nextDestination,
        }),
        data: {
          signup_flow: true,
          full_name: fullName,
          first_name: firstName,
          middle_name: middleName,
          surname,
          dob,
          phone,
          investment_plan: "Starter",
        },
      },
    });

    if (error) {
      setFormError(formatSupabaseError(error));
      setLoading(false);
      return;
    }

    if (!data.user) {
      setFormError("Failed to create user");
      setLoading(false);
      return;
    }

    // Investor row + optional welcome notification are created by DB trigger
    // `sync_investor_profile_from_auth_user` (see migration). Client insert fails when email
    // confirmation is on because there is no JWT yet for RLS.

    if (data.session) {
      setFormSuccess("Account created. You’re signed in.");
    } else {
      setFormSuccess(
        "Your account has been created. Check your email and verify your address to activate your account — then you can sign in.",
      );
    }

    setIsLogin(true);
    setLoading(false);
    return;
  }

  // SUCCESS SCREEN

  return (
    <main className="relative min-h-[100svh] text-white overflow-hidden">

      {/* Ambient Background */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-yellow-500/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-yellow-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-2xl flex-col bg-zinc-900/90 border border-zinc-800 backdrop-blur-xl px-6 py-8 sm:my-10 sm:rounded-[36px] sm:p-10 sm:shadow-2xl">

        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 self-start text-sm text-zinc-400 transition hover:text-yellow-500 sm:mb-4"
        >
          <ArrowLeft size={16} />
          Back to home
        </Link>

        <div className="mb-8 sm:mb-10">
          <h1 className="text-3xl font-black tracking-tight text-yellow-500 mb-3 sm:text-5xl">
            {isLogin ? "Login" : "Sign Up"}
          </h1>

          <p className="text-zinc-500 text-base leading-relaxed sm:text-lg">
            {isLogin
              ? "Secure access to your ZUNO investment dashboard"
              : "Begin your premium investment journey with ZUNO"}
          </p>
        </div>

        {authCallbackError ? (
          <div
            className="mb-6 rounded-2xl border border-red-500/60 bg-red-500/10 px-5 py-4 text-red-300"
            role="alert"
          >
            {authCallbackError}
          </div>
        ) : null}

        {formError ? (
          <div
            className="mb-6 rounded-2xl border border-red-500/60 bg-red-500/10 px-5 py-4 text-red-300"
            role="alert"
          >
            {formError}
          </div>
        ) : null}

        {formSuccess ? (
          <div
            className="mb-6 rounded-2xl border border-green-500/60 bg-green-500/10 px-5 py-4 text-green-300"
            role="status"
          >
            {formSuccess}
          </div>
        ) : null}

        {/* REGISTRATION FIELDS */}
        {!isLogin && (
          <>

            <div className="grid md:grid-cols-2 gap-6 mb-6">

              <div>
                <label className="block mb-3 text-zinc-400 text-sm">
                  First Name
                </label>

                <input
                  type="text"
                  placeholder="Enter first name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={`w-full bg-zinc-900 border rounded-2xl px-5 py-4 text-white outline-none transition-all duration-300 ${
  errors.firstName
    ? "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)]"
    : "border-zinc-700 focus:border-yellow-500"
}`}
                />
              </div>

              <div>
                <label className="block mb-3 text-zinc-400 text-sm">
                  Middle Name (Optional)
                </label>

                <input
                  type="text"
                  placeholder="Enter middle name"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-2xl px-5 py-4 outline-none focus:border-yellow-500 transition"
                />
              </div>

            </div>

            <div className="mb-6">
              <label className="block mb-3 text-zinc-400 text-sm">
                Surname
              </label>

              <input
                type="text"
                placeholder="Enter surname"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                className={`w-full bg-zinc-900 border rounded-2xl px-5 py-4 text-white outline-none transition-all duration-300 ${
  errors.surname
    ? "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)]"
    : "border-zinc-700 focus:border-yellow-500"
}`}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">

              <div>
                <label className="block mb-3 text-zinc-400 text-sm">
                  Date of Birth
                </label>

                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                 className={`w-full bg-zinc-900 border rounded-2xl px-5 py-4 text-white outline-none transition-all duration-300 ${
  errors.dob
    ? "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)]"
    : "border-zinc-700 focus:border-yellow-500"
}`}
                />
              </div>

              <div>
                <label className="block mb-3 text-zinc-400 text-sm">
                  Phone Number
                </label>

                <input
                  type="tel"
                  placeholder="+254 700 000 000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full bg-zinc-900 border rounded-2xl px-5 py-4 text-white outline-none transition-all duration-300 ${
  errors.phone
    ? "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)]"
    : "border-zinc-700 focus:border-yellow-500"
}`}
                />
              </div>

            </div>

          </>
        )}

        {/* EMAIL */}
        <div className="mb-6">

          <label className="block mb-3 text-zinc-400 text-sm">
            Email Address
          </label>

          <input
            type="email"
            placeholder="Enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
           className={`w-full bg-zinc-900 border rounded-2xl px-5 py-4 text-white outline-none transition-all duration-300 ${
  errors.email
    ? "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)]"
    : "border-zinc-700 focus:border-yellow-500"
}`}
          />

        </div>

        {/* PASSWORD */}
        <div className="mb-6 relative">

          <label className="block mb-3 text-zinc-400 text-sm">
            Password
          </label>

          <input
            type={showPassword ? "text" : "password"}
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full bg-zinc-900 border rounded-2xl px-5 py-4 text-white outline-none transition-all duration-300 ${
  errors.password
    ? "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)]"
    : "border-zinc-700 focus:border-yellow-500"
}`}

          />
  
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-5 top-[52px] text-zinc-500 hover:text-yellow-500 transition"
          >
            {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
          </button>

        </div>

        {isLogin ? (
          <div className="flex justify-end -mt-2 mb-6">
            <button
              type="button"
              onClick={() => router.push("/forgot-password")}
              className="text-sm text-yellow-500 hover:text-yellow-400 transition"
            >
              Forgot Password?
            </button>
          </div>
        ) : null}

        {/* CONFIRM PASSWORD */}
        {!isLogin && (
          <div className="mb-6 relative">

            <label className="block mb-3 text-zinc-400 text-sm">
              Confirm Password
            </label>

            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full bg-zinc-900 border rounded-2xl px-5 py-4 text-white outline-none transition-all duration-300 ${
  errors.password
    ? "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)]"
    : "border-zinc-700 focus:border-yellow-500"
}`}
            />

            <button
              type="button"
              onClick={() =>
                setShowConfirmPassword(!showConfirmPassword)
              }
              className="absolute right-5 top-[52px] text-zinc-500 hover:text-yellow-500 transition"
            >
              {showConfirmPassword ? (
                <EyeOff size={22} />
              ) : (
                <Eye size={22} />
              )}
            </button>

          </div>
        )}

        {/* TERMS */}
{!isLogin && (
  <div
    className={`mb-8 rounded-2xl border p-5 transition-all duration-300 ${
      errors.terms
        ? "border-red-500 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.25)]"
        : "border-zinc-800 bg-black"
    }`}
  >

    <label className="flex items-start gap-4 cursor-pointer">

      <input
        type="checkbox"
        checked={acceptedTerms}
        onChange={(e) => setAcceptedTerms(e.target.checked)}
        className="mt-1 w-5 h-5 accent-yellow-500"
      />

      <div>

        <p className="text-zinc-300 leading-relaxed">
          I agree to the ZUNO Terms & Conditions,
          Privacy Policy, and understand that investment
          performance may vary depending on market conditions.
        </p>

        <a
          href="/terms"
          target="_blank"
          className="mt-3 inline-block text-yellow-500 hover:text-yellow-400 transition font-semibold"
        >
          View Terms & Conditions
        </a>

        {errors.terms && (
          <p className="text-red-400 text-sm mt-3">
            You must accept the Terms & Conditions before registering.
          </p>
        )}

      </div>

    </label>

  </div>
)}

        {/* BUTTON */}
        <button
          onClick={handleAuth}
          disabled={loading}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-5 rounded-2xl transition-all duration-300 hover:scale-[1.01] text-lg"
        >
          {loading
            ? "Processing..."
            : isLogin
            ? "Login"
            : "Create Account"}
        </button>

        {/* TOGGLE */}
        <div className="mt-8 text-center text-zinc-500">

          {isLogin
            ? "Don't have an account?"
            : "Already have an account?"}

          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setFormError(null);
              setFormSuccess(null);
            }}
            className="ml-2 text-yellow-500 hover:text-yellow-400 font-semibold transition"
          >
            {isLogin ? "Create Account" : "Login"}
          </button>

        </div>

      </div>

    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[100svh] text-white flex items-center justify-center">
          <p className="text-zinc-400 text-sm">Loading…</p>
        </main>
      }
    >
      <AuthPageInner />
    </Suspense>
  );
}
