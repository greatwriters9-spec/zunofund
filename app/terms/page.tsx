import { MarketingNavbar } from "@/components/navbar";
import { TermsLegalContent } from "@/components/terms/TermsLegalContent";
import { TermsPageLayout } from "@/components/terms/TermsPageLayout";
import { TermsTableOfContents } from "@/components/terms/TermsTableOfContents";

export default function TermsPage() {
  return (
    <div className="flex min-h-[100svh] flex-col bg-[#F8F8F8] text-zinc-900 lg:min-h-0 lg:bg-transparent lg:text-inherit">
      <MarketingNavbar />
      <TermsPageLayout
        legalContent={
          <>
            <TermsTableOfContents />
            <TermsLegalContent />
          </>
        }
      />
    </div>
  );
}
