import { InvestorDesktopShell } from "@/components/investor/InvestorDesktopShell";

export default function P2pLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <InvestorDesktopShell>{children}</InvestorDesktopShell>;
}
