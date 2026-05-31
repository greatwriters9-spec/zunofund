import { InvestorDesktopShell } from "@/components/investor/InvestorDesktopShell";

export default function InvestorAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <InvestorDesktopShell>{children}</InvestorDesktopShell>;
}
