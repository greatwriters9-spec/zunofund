import { InvestorShellGate } from "@/components/investor/InvestorShellGate";

export default function InvestorAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <InvestorShellGate>{children}</InvestorShellGate>;
}
