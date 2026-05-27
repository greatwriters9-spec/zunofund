import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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
  themeColor: "#05080F",
};

export const metadata: Metadata = {
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
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: "/logo.png",
  },
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
        className="min-h-full flex flex-col bg-[#05080F] text-white"
        suppressHydrationWarning
      >
        {/* GLOBAL AMBIENT BACKGROUND — applied to every page */}
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(135deg,#05080F_0%,#0B1320_45%,#141B2D_75%,#1E293B_100%)]" />
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_82%_18%,rgba(212,175,55,0.22),transparent_50%)]" />
        <div className="pointer-events-none fixed -top-40 -right-32 -z-10 w-[720px] h-[720px] rounded-full bg-[#D4AF37]/20 blur-[170px]" />
        <div className="pointer-events-none fixed top-[40%] -left-32 -z-10 w-[520px] h-[520px] rounded-full bg-[#F5E6B3]/8 blur-[180px]" />
        <div className="pointer-events-none fixed -bottom-48 left-[20%] -z-10 w-[640px] h-[640px] rounded-full bg-[#1E293B]/60 blur-[200px]" />
        <div
          className="pointer-events-none fixed inset-0 -z-10 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />

        <RealtimeNotificationBridge />
        <MerchantPresenceBridge />
        {children}
      </body>
    </html>
  );
}
