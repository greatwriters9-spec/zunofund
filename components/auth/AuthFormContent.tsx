"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type RefObject } from "react";

import { AuthRecaptcha, type AuthRecaptchaHandle } from "@/components/auth/AuthRecaptcha";
import { AuthSocialButtons } from "@/components/auth/AuthSocialButtons";
import { useRecaptchaActiveBranch } from "@/components/auth/useRecaptchaActiveBranch";
import { authFieldClass, authLabelClass } from "@/components/auth/authFormStyles";
import { PhoneInput } from "@/components/auth/PhoneInput";

type AuthFormContentProps = {
  theme: "light" | "dark";
  variant?: "default" | "mobile";
  isLogin: boolean;
  authNotice: string | null;
  authCallbackError: string | null;
  formError: string | null;
  formSuccess: string | null;
  referralCode: string;
  firstName: string;
  setFirstName: (v: string) => void;
  middleName: string;
  setMiddleName: (v: string) => void;
  surname: string;
  setSurname: (v: string) => void;
  dob: string;
  setDob: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (v: boolean) => void;
  acceptedTerms: boolean;
  setAcceptedTerms: (v: boolean) => void;
  errors: {
    firstName: boolean;
    surname: boolean;
    dob: boolean;
    phone: boolean;
    email: boolean;
    password: boolean;
    confirmPassword: boolean;
    terms: boolean;
  };
  loading: boolean;
  onSubmit: () => void;
  onToggleMode: () => void;
  onSignupStep1Validate: () => boolean;
  recaptchaRef: RefObject<AuthRecaptchaHandle | null>;
  recaptchaError: string | null;
  onRecaptchaExpire: () => void;
};

export function AuthFormContent({
  theme,
  variant = "default",
  isLogin,
  authNotice,
  authCallbackError,
  formError,
  formSuccess,
  referralCode,
  firstName,
  setFirstName,
  middleName,
  setMiddleName,
  surname,
  setSurname,
  dob,
  setDob,
  phone,
  setPhone,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  acceptedTerms,
  setAcceptedTerms,
  errors,
  loading,
  onSubmit,
  onToggleMode,
  onSignupStep1Validate,
  recaptchaRef,
  recaptchaError,
  onRecaptchaExpire,
}: AuthFormContentProps) {
  const router = useRouter();
  const isMobile = variant === "mobile";
  const isLight = theme === "light" || isMobile;
  const [signupStep, setSignupStep] = useState(1);

  useEffect(() => {
    if (isLogin) setSignupStep(1);
  }, [isLogin]);

  const alertOk = isLight
    ? "mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"
    : "mb-6 rounded-2xl border border-emerald-500/50 bg-emerald-500/10 px-5 py-4 text-emerald-200";
  const alertErr = isLight
    ? "mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
    : "mb-6 rounded-2xl border border-red-500/60 bg-red-500/10 px-5 py-4 text-red-300";
  const alertSuccess = isLight
    ? "mb-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800"
    : "mb-6 rounded-2xl border border-green-500/60 bg-green-500/10 px-5 py-4 text-green-300";
  const referralBox = isLight
    ? "mb-3 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/5 px-4 py-2.5 text-sm text-zinc-700"
    : "mb-6 rounded-2xl border border-yellow-500/35 bg-yellow-500/10 px-5 py-4 text-sm text-yellow-100";

  const titleClass = isLight
    ? "text-[1.5rem] font-bold tracking-tight text-zinc-900"
    : "text-3xl font-black tracking-tight text-yellow-500 sm:text-5xl";
  const subtitleClass = isLight
    ? "mt-1 text-sm text-zinc-500"
    : "text-zinc-500 text-base leading-relaxed sm:text-lg";
  const kickerClass = isLight
    ? "text-xs font-semibold text-[#C9A227]"
    : "text-sm text-zinc-400";

  const primaryBtn = isLight
    ? "rounded-lg bg-[#D4AF37] py-3.5 text-sm font-bold text-black transition hover:bg-[#E5BD45] disabled:cursor-not-allowed disabled:opacity-60"
    : "w-full rounded-2xl bg-yellow-500 py-5 text-lg font-black text-black transition hover:bg-yellow-400 hover:scale-[1.01] disabled:opacity-60";

  const toggleText = isLight ? "text-sm text-zinc-500" : "text-center text-zinc-500";
  const toggleLink = isLight
    ? "font-semibold text-[#C9A227] hover:text-[#B8921F]"
    : "font-semibold text-yellow-500 hover:text-yellow-400";

  const passwordToggleTop = isLight ? "top-[1.85rem]" : "top-[52px]";
  const fieldGap = isMobile ? "mb-2" : isLight ? "mb-2.5" : "mb-6";
  const termsBox = isLight
    ? `rounded-lg border p-3.5 ${
        errors.terms ? "border-red-300 bg-red-50" : "border-zinc-200 bg-zinc-50"
      }`
    : `mb-8 rounded-2xl border p-5 ${
        errors.terms
          ? "border-red-500 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.25)]"
          : "border-zinc-800 bg-black"
      }`;

  function handleNextStep() {
    if (onSignupStep1Validate()) {
      setSignupStep(2);
    }
  }

  const showSignupStep1 = !isLogin && signupStep === 1;
  const showSignupStep2 = !isLogin && signupStep === 2;
  const recaptchaActive = useRecaptchaActiveBranch(variant === "mobile" ? "mobile" : "default");

  const recaptchaBlock = (
    <div className={isLight ? "mb-4" : "mb-6"}>
      {recaptchaError ? (
        <p className="mb-2 text-center text-sm text-red-500" role="alert">
          {recaptchaError}
        </p>
      ) : null}
      <AuthRecaptcha
        key={isLogin ? "auth-login" : "auth-signup"}
        ref={recaptchaActive ? recaptchaRef : null}
        active={recaptchaActive}
        theme={isLight ? "light" : "dark"}
        onExpire={onRecaptchaExpire}
      />
    </div>
  );

  return (
    <>
      {!isMobile && isLight ? (
        <div className="mb-4">
          <p className={kickerClass}>{isLogin ? "Welcome back" : "Join Zuno"}</p>
          <h1 className={`${titleClass} mt-0.5`}>
            {isLogin ? "Log in to your account" : "Create your account"}
          </h1>
          <p className={subtitleClass}>
            {isLogin
              ? "Secure access to your ZUNO investment dashboard"
              : "Begin your premium investment journey with Zuno"}
          </p>
          {!isLogin ? (
            <p className="mt-3 text-xs font-medium text-zinc-400">Step {signupStep} of 2</p>
          ) : null}
        </div>
      ) : null}

      {!isMobile && !isLight ? (
        <div className="mb-8 sm:mb-10">
          <h1 className={`${titleClass} mb-3`}>{isLogin ? "Login" : "Sign Up"}</h1>
          <p className={subtitleClass}>
            {isLogin
              ? "Secure access to your ZUNO investment dashboard"
              : "Begin your premium investment journey with Zuno"}
          </p>
          {!isLogin ? (
            <p className="mt-3 text-sm font-medium text-zinc-500">Step {signupStep} of 2</p>
          ) : null}
        </div>
      ) : null}

      {isMobile && !isLogin ? (
        <p className="mb-3 text-center text-xs font-medium text-zinc-400">
          Step {signupStep} of 2
        </p>
      ) : null}

      {showSignupStep1 && isLight ? (
        <>
          <AuthSocialButtons theme="light" />
          <div className={`flex items-center gap-3 ${isMobile ? "my-3" : "my-4"}`}>
            <div className="h-px flex-1 bg-zinc-200" />
            <span className="text-xs text-zinc-400">
              {isLogin ? "or log in with email" : "or sign up with email"}
            </span>
            <div className="h-px flex-1 bg-zinc-200" />
          </div>
        </>
      ) : null}

      {isMobile && isLogin ? (
        <>
          <AuthSocialButtons theme="light" />
          <div className="my-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200" />
            <span className="text-xs text-zinc-400">or log in with email</span>
            <div className="h-px flex-1 bg-zinc-200" />
          </div>
        </>
      ) : null}

      {authNotice ? (
        <div className={alertOk} role="status">
          {authNotice}
        </div>
      ) : null}
      {authCallbackError ? (
        <div className={alertErr} role="alert">
          {authCallbackError}
        </div>
      ) : null}
      {formError ? (
        <div className={alertErr} role="alert">
          {formError}
        </div>
      ) : null}
      {formSuccess ? (
        <div className={alertSuccess} role="status">
          {formSuccess}
        </div>
      ) : null}
      {showSignupStep1 && referralCode ? (
        <div className={referralBox}>
          Referral code{" "}
          <span className={`font-mono font-bold ${isLight ? "text-[#C9A227]" : "text-yellow-300"}`}>
            {referralCode}
          </span>{" "}
          will be applied to your account.
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {isLogin ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <div className={isLight ? "mb-3" : "mb-6"}>
              <label className={authLabelClass(theme)}>Email Address</label>
              <input
                type="email"
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={authFieldClass(errors.email, theme)}
              />
            </div>

            <div className={`relative ${isLight ? "mb-3" : "mb-6"}`}>
              <label className={authLabelClass(theme)}>Password</label>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${authFieldClass(errors.password, theme)} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-4 ${passwordToggleTop} text-zinc-400 transition hover:text-[#C9A227]`}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={isLight ? 18 : 22} /> : <Eye size={isLight ? 18 : 22} />}
              </button>
            </div>

            <div className={`-mt-1 ${isLight ? "mb-4" : "mb-6"} flex justify-end`}>
              <button
                type="button"
                onClick={() => router.push("/forgot-password")}
                className={`text-sm transition ${isLight ? "font-medium text-[#C9A227]" : "text-yellow-500 hover:text-yellow-400"}`}
              >
                Forgot Password?
              </button>
            </div>

            {recaptchaBlock}

            <button
              type="button"
              onClick={onSubmit}
              disabled={loading}
              className={`${primaryBtn} w-full`}
            >
              {loading ? "Processing..." : "Log in"}
            </button>
          </motion.div>
        ) : showSignupStep1 ? (
          <motion.div
            key="signup-step-1"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <div className={`grid gap-2.5 sm:grid-cols-2 ${fieldGap}`}>
              <div>
                <label className={authLabelClass(theme)}>First Name</label>
                <input
                  type="text"
                  placeholder="Enter first name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={authFieldClass(errors.firstName, theme)}
                />
              </div>
              <div>
                <label className={authLabelClass(theme)}>Middle Name (Optional)</label>
                <input
                  type="text"
                  placeholder="Enter middle name"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className={authFieldClass(false, theme)}
                />
              </div>
            </div>

            <div className={`grid gap-2.5 sm:grid-cols-2 ${fieldGap}`}>
              <div>
                <label className={authLabelClass(theme)}>Surname</label>
                <input
                  type="text"
                  placeholder="Enter surname"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  className={authFieldClass(errors.surname, theme)}
                />
              </div>
              <div>
                <label className={authLabelClass(theme)}>Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className={authFieldClass(errors.dob, theme)}
                />
              </div>
            </div>

            <div className={fieldGap}>
              <label className={authLabelClass(theme)}>Phone Number</label>
              <PhoneInput value={phone} onChange={setPhone} error={errors.phone} />
            </div>

            <div className={fieldGap}>
              <label className={authLabelClass(theme)}>Email Address</label>
              <input
                type="email"
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={authFieldClass(errors.email, theme)}
              />
            </div>

            <button
              type="button"
              onClick={handleNextStep}
              className={`${primaryBtn} mt-1 w-full`}
            >
              Next
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="signup-step-2"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <div className={`relative ${fieldGap}`}>
              <label className={authLabelClass(theme)}>Password</label>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${authFieldClass(errors.password, theme)} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-4 ${passwordToggleTop} text-zinc-400 transition hover:text-[#C9A227]`}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={isLight ? 18 : 22} /> : <Eye size={isLight ? 18 : 22} />}
              </button>
            </div>

            <div className={`relative ${fieldGap}`}>
              <label className={authLabelClass(theme)}>Confirm Password</label>
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`${authFieldClass(errors.confirmPassword, theme)} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className={`absolute right-4 ${passwordToggleTop} text-zinc-400 transition hover:text-[#C9A227]`}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff size={isLight ? 18 : 22} /> : <Eye size={isLight ? 18 : 22} />}
              </button>
            </div>

            <div className={`${fieldGap} ${isLight ? "" : "mb-6"}`}>
              <div className={termsBox}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#D4AF37]"
                  />
                  <div>
                    <p className={`text-sm leading-relaxed ${isLight ? "text-zinc-600" : "text-zinc-300"}`}>
                      I agree to the ZUNO{" "}
                      <Link
                        href="/terms"
                        target="_blank"
                        className={`font-semibold ${isLight ? "text-[#C9A227]" : "text-yellow-500"}`}
                      >
                        Terms & Conditions
                      </Link>
                      , Privacy Policy, and understand that investment performance may vary depending on
                      market conditions.
                    </p>
                    {errors.terms ? (
                      <p className="mt-2 text-sm text-red-500">
                        You must accept the Terms & Conditions before registering.
                      </p>
                    ) : null}
                  </div>
                </label>
              </div>
            </div>

            {recaptchaBlock}

            <div className={`flex gap-3 ${isLight ? "" : "flex-col"}`}>
              <button
                type="button"
                onClick={() => setSignupStep(1)}
                className={
                  isLight
                    ? "flex-1 rounded-lg border border-zinc-200 bg-white py-3.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                    : "w-full rounded-2xl border border-zinc-700 py-4 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600"
                }
              >
                Back
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={loading}
                className={`${primaryBtn} ${isLight ? "flex-[1.4]" : "w-full"}`}
              >
                {loading ? "Processing..." : "Create account"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`${isLight ? "mt-5 text-center" : "mt-8 text-center"} ${toggleText}`}>
        {isLogin ? "Don't have an account?" : "Have an account?"}
        <button type="button" onClick={onToggleMode} className={`ml-2 ${toggleLink}`}>
          {isLogin ? "Create account" : "Log in"}
        </button>
      </div>
    </>
  );
}
