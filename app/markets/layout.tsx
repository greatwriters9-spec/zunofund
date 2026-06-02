import { InvestorShellGate } from "@/components/investor/InvestorShellGate";

export default function MarketsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <InvestorShellGate>{children}</InvestorShellGate>;
}
