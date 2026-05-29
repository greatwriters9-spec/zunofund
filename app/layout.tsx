import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { InvestorPresenceBridge } from "@/components/InvestorPresenceBridge";
import { MerchantPresenceBridge } from "@/components/MerchantPresenceBridge";
import { RealtimeNotificationBridge } from "@/components/RealtimeNotificationBridge";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#05080F",
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.zunofund.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Zuno",
    template: "%s | Zuno",
  },
  description:
    "Zuno — Strategic capital growth, structured investment plans, and disciplined portfolio management for modern investors.",
  keywords: [
    "Zuno",
    "Zunofund",
    "investment platform",
    "portfolio management",
    "investor dashboard",
    "wealth growth",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="mobile-render-stable min-h-full flex flex-col bg-[#05080F] text-white overflow-x-clip"
        suppressHydrationWarning
      >
        {/* Ambient background: desktop only — fixed layers tear on many Android GPUs */}
        <div
          className="ambient-background-root pointer-events-none fixed inset-0 -z-10 hidden lg:block"
          aria-hidden
        >
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#05080F_0%,#0B1320_45%,#141B2D_75%,#1E293B_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(212,175,55,0.22),transparent_50%)]" />
          <div className="ambient-blur-orb absolute -top-40 -right-32 h-[720px] w-[720px] rounded-full bg-[#D4AF37]/20 blur-[170px]" />
          <div className="ambient-blur-orb absolute top-[40%] -left-32 h-[520px] w-[520px] rounded-full bg-[#F5E6B3]/8 blur-[180px]" />
          <div className="ambient-blur-orb absolute -bottom-48 left-[20%] h-[640px] w-[640px] rounded-full bg-[#1E293B]/60 blur-[200px]" />
          <div
            className="ambient-grid-overlay absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "80px 80px",
            }}
          />
        </div>

        <RealtimeNotificationBridge />
        <InvestorPresenceBridge />
        <MerchantPresenceBridge />
        {children}
      </body>
    </html>
  );
}
