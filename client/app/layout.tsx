import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Pwa from "./components/Pwa";
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
  title: "Friendly Game",
  description: "A two-player board game of love, dares, memories and gifts",
  applicationName: "Friendly Game",
  appleWebApp: { capable: true, title: "Friendly Game", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#1b1020",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // suppressHydrationWarning: browser extensions (Grammarly, ColorZilla, password
  // managers…) add attributes to <html>/<body> before React loads. This only
  // ignores attribute differences on these two tags, not on anything inside them.
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
