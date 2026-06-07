"use client";

import type { ReactNode } from "react";

import { AuthMessagingPanel } from "@/components/auth/AuthMessagingPanel";
import { AuthTrustBar } from "@/components/auth/AuthTrustBar";

type AuthSplitLayoutProps = {
  children: ReactNode;
  mobileChildren?: ReactNode;
};

export function AuthSplitLayout({
  children,
  mobileChildren,
}: AuthSplitLayoutProps) {
  return (
    <>
      {/* Mobile — minimal onboarding */}
      <main className="flex flex-1 flex-col bg-white text-zinc-900 lg:hidden">
        <div className="mx-auto w-full max-w-md flex-1 px-5 pb-8 pt-4">
          {mobileChildren ?? children}
        </div>
      </main>

      {/* Desktop */}
      <main className="relative hidden min-h-[calc(100svh-5.5rem)] flex-col bg-white text-zinc-900 lg:flex">
        <div className="grid flex-1 lg:grid-cols-2">
          <div className="flex items-center justify-center px-10 py-12 xl:px-16">
            <div className="w-full max-w-[420px] rounded-2xl border border-zinc-100 bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.06)] xl:p-10">
              {children}
            </div>
          </div>

          <div className="relative border-l border-zinc-100 bg-white">
            <AuthMessagingPanel />
          </div>
        </div>

        <AuthTrustBar />
      </main>
    </>
  );
}
