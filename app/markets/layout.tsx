import { InvestorDesktopShell } from "@/components/investor/InvestorDesktopShell";

export default function MarketsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <InvestorDesktopShell>{children}</InvestorDesktopShell>;
}
