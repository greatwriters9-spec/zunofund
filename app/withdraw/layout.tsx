import { InvestorDesktopShell } from "@/components/investor/InvestorDesktopShell";

export default function WithdrawLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <InvestorDesktopShell>{children}</InvestorDesktopShell>;
}
