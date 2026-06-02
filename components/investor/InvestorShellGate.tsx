"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { useSupabase } from "@/lib/supabase";
import { InvestorDesktopShell } from "@/components/investor/InvestorDesktopShell";

type InvestorShellGateProps = {
  children: ReactNode;
};

/**
 * Shows investor desktop chrome only for authenticated users.
 * Guests get public-style pages without sidebar/top dashboard shell.
 */
export function InvestorShellGate({ children }: InvestorShellGateProps) {
  const supabase = useSupabase();
  const [hasUser, setHasUser] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadAuthState() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      setHasUser(Boolean(user?.id));
    }
    void loadAuthState();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  if (hasUser) {
    return <InvestorDesktopShell>{children}</InvestorDesktopShell>;
  }

  return (
    <div className="min-h-screen bg-[#05080F] text-white" aria-busy={hasUser === null}>
      <header className="sticky top-0 z-40 border-b border-zinc-800/90 bg-[#05080F]/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-end gap-2">
          <Link
            href="/auth"
            className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-[#D4AF37]/45"
          >
            Sign In
          </Link>
          <Link
            href="/auth?signup=1"
            className="inline-flex items-center rounded-lg bg-[#D4AF37] px-3 py-2 text-sm font-semibold text-black transition hover:bg-[#E5BD45]"
          >
            Create Account
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
