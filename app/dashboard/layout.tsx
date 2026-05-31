import { InvestorDesktopShell } from "@/components/investor/InvestorDesktopShell";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <InvestorDesktopShell>{children}</InvestorDesktopShell>;
}
