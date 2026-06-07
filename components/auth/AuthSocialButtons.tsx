"use client";

type AuthSocialButtonsProps = {
  theme?: "light" | "dark";
};

function SocialButton({
  label,
  icon,
  theme,
}: {
  label: string;
  icon: React.ReactNode;
  theme: "light" | "dark";
}) {
  return (
    <button
      type="button"
      aria-label={`Continue with ${label}`}
      className={
        theme === "dark"
          ? "flex flex-1 items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3.5 text-sm font-medium text-white transition hover:border-zinc-600"
          : "flex flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
      }
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function AuthSocialButtons({ theme = "light" }: AuthSocialButtonsProps) {
  return (
    <div className="flex gap-3">
      <SocialButton
        label="Google"
        theme={theme}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        }
      />
      <SocialButton
        label="Apple"
        theme={theme}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C4.79 15.25 5.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
        }
      />
      <SocialButton
        label="Telegram"
        theme={theme}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <circle cx="12" cy="12" r="12" fill="#26A5E4" />
            <path
              fill="#fff"
              d="M5.5 11.5c3.5-1.5 5.83-2.5 7-3 3-.9 3.62-.95 4.03-.1.23.5.17 1.15-.1 1.58-.7 1.2-2.5 3.35-3.5 4.45-.7.75-1.95 1.55-1.15 2.4.75.8 2.65 1.95 3.95 2.65 1.1.6 1.95 1.05 2.25 1.35.55.55.95 1.45.05 1.95-1 .55-4.45 2.2-5.5 2.7-1.35.65-2.35.95-3.2.6-.95-.4-1.1-1.65-1.65-2.85-.9-1.95-1.65-3.75-2.3-5.45-.6-1.5-1.25-3.05-.05-4.35z"
            />
          </svg>
        }
      />
    </div>
  );
}
