import type { ReactNode } from "react";

import { AuthTrustBar } from "@/components/auth/AuthTrustBar";
import { TermsMessagingPanel } from "@/components/terms/TermsMessagingPanel";

type TermsPageLayoutProps = {
  legalContent: ReactNode;
  mobileIntro?: ReactNode;
};

export function TermsPageLayout({ legalContent, mobileIntro }: TermsPageLayoutProps) {
  return (
    <>
      {/* Mobile */}
      <main className="bg-[#F8F8F8] text-zinc-900 lg:hidden">
        <div className="mx-auto w-full max-w-lg px-5 pb-10 pt-6">
          {mobileIntro ?? <TermsMessagingPanel />}
          <div className="mt-8 w-full rounded-2xl border border-zinc-100 bg-white p-6 shadow-[0_8px_40px_rgba(0,0,0,0.06)] sm:p-8">
            {legalContent}
          </div>
        </div>
      </main>

      {/* Desktop */}
      <main className="relative hidden min-h-[calc(100svh-5.5rem)] flex-col bg-[#F8F8F8] text-zinc-900 lg:flex">
        <div className="grid flex-1 lg:grid-cols-2">
          <div className="flex justify-center px-8 py-12 xl:px-16">
            <div className="w-full max-w-[480px] rounded-2xl border border-zinc-100 bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.06)] xl:p-10">
              {legalContent}
            </div>
          </div>

          <div className="relative border-l border-zinc-100 bg-[#F8F8F8]">
            <TermsMessagingPanel />
          </div>
        </div>

        <AuthTrustBar />
      </main>
    </>
  );
}
