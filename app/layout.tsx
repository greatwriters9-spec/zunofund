import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <RealtimeNotificationBridge />
        {children}
      </body>
    </html>
  );
}
