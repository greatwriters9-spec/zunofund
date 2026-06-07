"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { AuthRecaptchaHandle } from "@/components/auth/AuthRecaptcha";
import { AuthFormContent } from "@/components/auth/AuthFormContent";
import { AuthMobileHero } from "@/components/auth/AuthMobileHero";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { MarketingNavbar } from "@/components/navbar";
import { loginHref, sanitizeNextParam, signupHref } from "@/lib/authLinks";
import { isValidPhoneE164 } from "@/lib/phoneCountries";
import { normalizeReferralCodeInput } from "@/lib/referrals";
import { authRedirectToUrl } from "@/lib/site-url";
import { RECAPTCHA_MESSAGES } from "@/lib/recaptcha/messages";
import { guardAuthActionWithRecaptcha } from "@/lib/recaptcha/guardSubmit";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

function AuthPageInner() {
  const supabase = useSupabase();
  const searchParams = useSearchParams();
  const router = useRouter();
  const wantsSignup = searchParams.get("signup") === "1";
  const authCallbackError = searchParams.get("error");
  const authNotice = searchParams.get("notice");
  const referralCode = normalizeReferralCodeInput(searchParams.get("ref"));
  const sanitizedNext = searchParams.get("next");
  const resolvedNext = sanitizeNextParam(sanitizedNext) ?? "/dashboard";

  const [isLogin, setIsLogin] = useState(!wantsSignup);

  useEffect(() => {
    setIsLogin(!wantsSignup);
  }, [wantsSignup]);

  useEffect(() => {
    if (authNotice?.trim()) setIsLogin(true);
  }, [authNotice]);

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
  const [recaptchaError, setRecaptchaError] = useState<string | null>(null);
  const recaptchaRef = useRef<AuthRecaptchaHandle>(null);

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

  async function handleAuth() {
    setFormError(null);
    setFormSuccess(null);
    setLoading(true);

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
          "Your account exists, but no login session was created. If you just signed up, open the email Supabase sent and confirm your email, then try logging in again.",
        );
        setLoading(false);
        return;
      }

      await supabase.auth.getSession();

      window.location.assign(resolvedNext);
      return;
    }

    const newErrors = {
      firstName: !firstName,
      surname: !surname,
      dob: !dob,
      phone: !phone || !isValidPhoneE164(phone),
      email: !email,
      password: !password,
      confirmPassword: !confirmPassword,
      terms: !acceptedTerms,
    };

    setErrors(newErrors);

    if (Object.values(newErrors).some(Boolean)) {
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrors({
        ...newErrors,
        password: true,
        confirmPassword: true,
      });

      setLoading(false);

      return;
    }
    setLoading(true);

    const fullName = [firstName, middleName, surname].filter(Boolean).join(" ");

    let emailRedirectTo = authRedirectToUrl("/auth/callback", {
      next: resolvedNext,
    });
    try {
      const r = await fetch(
        `/api/auth/email-confirmation-redirect?next=${encodeURIComponent(resolvedNext)}`,
        { cache: "no-store" },
      );
      if (r.ok) {
        const j = (await r.json()) as { redirectTo?: string };
        if (
          typeof j.redirectTo === "string" &&
          /^https?:\/\//i.test(j.redirectTo)
        ) {
          emailRedirectTo = j.redirectTo;
        }
      }
    } catch {
      /* keep authRedirectToUrl fallback */
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo,
        data: {
          signup_flow: true,
          full_name: fullName,
          first_name: firstName,
          middle_name: middleName,
          surname,
          dob,
          phone,
          investment_plan: "Starter",
          referral_code: referralCode || undefined,
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

  async function handleAuthSubmit() {
    await guardAuthActionWithRecaptcha(recaptchaRef, setRecaptchaError, handleAuth);
  }

  function handleToggleMode() {
    setFormError(null);
    setFormSuccess(null);
    setRecaptchaError(null);
    recaptchaRef.current?.reset();
    const target = isLogin ? signupHref(resolvedNext) : loginHref(resolvedNext);
    router.push(referralCode ? `${target}${target.includes("?") ? "&" : "?"}ref=${referralCode}` : target);
  }

  function validateSignupStep1() {
    const stepErrors = {
      firstName: !firstName,
      surname: !surname,
      dob: !dob,
      phone: !phone || !isValidPhoneE164(phone),
      email: !email,
    };

    setErrors((prev) => ({
      ...prev,
      ...stepErrors,
      password: false,
      confirmPassword: false,
      terms: false,
    }));

    return !Object.values(stepErrors).some(Boolean);
  }

  const formProps = {
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
    onSubmit: () => void handleAuthSubmit(),
    onToggleMode: handleToggleMode,
    onSignupStep1Validate: validateSignupStep1,
    recaptchaRef,
    recaptchaError,
    onRecaptchaExpire: () => setRecaptchaError(RECAPTCHA_MESSAGES.expired),
  };

  return (
    <div className="flex min-h-[100svh] flex-col bg-white text-zinc-900 lg:min-h-0 lg:bg-transparent lg:text-inherit">
      <MarketingNavbar />
      <AuthSplitLayout
        mobileChildren={
          <>
            <AuthMobileHero />
            <AuthFormContent theme="light" variant="mobile" {...formProps} />
          </>
        }
      >
        <AuthFormContent theme="light" {...formProps} />
      </AuthSplitLayout>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100svh] items-center justify-center bg-white text-zinc-500 lg:bg-[#05080F] lg:text-zinc-400">
          <p className="text-sm">Loading…</p>
        </main>
      }
    >
      <AuthPageInner />
    </Suspense>
  );
}
