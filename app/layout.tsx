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
        {/* GLOBAL AMBIENT BACKGROUND — gradient-only on mobile; filter blur on lg+ */}
        <div
          className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(135deg,#05080F_0%,#0B1320_45%,#141B2D_75%,#1E293B_100%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_82%_18%,rgba(212,175,55,0.22),transparent_50%)] max-lg:opacity-80"
          aria-hidden
        />
        <div
          className="pointer-events-none fixed inset-0 -z-10 hidden max-lg:block bg-[radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(212,175,55,0.12),transparent_55%)]"
          aria-hidden
        />
        <div
          className="ambient-blur-orb pointer-events-none fixed -top-40 -right-32 -z-10 hidden h-[720px] w-[720px] rounded-full bg-[#D4AF37]/20 blur-[170px] lg:block"
          aria-hidden
        />
        <div
          className="ambient-blur-orb pointer-events-none fixed top-[40%] -left-32 -z-10 hidden h-[520px] w-[520px] rounded-full bg-[#F5E6B3]/8 blur-[180px] lg:block"
          aria-hidden
        />
        <div
          className="ambient-blur-orb pointer-events-none fixed -bottom-48 left-[20%] -z-10 hidden h-[640px] w-[640px] rounded-full bg-[#1E293B]/60 blur-[200px] lg:block"
          aria-hidden
        />
        <div
          className="ambient-grid-overlay pointer-events-none fixed inset-0 -z-10 opacity-[0.025] max-lg:hidden"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
          aria-hidden
        />

        <RealtimeNotificationBridge />
        <MerchantPresenceBridge />
        {children}
      </body>
    </html>
  );
}
