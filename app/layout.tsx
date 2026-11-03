import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import Providers from "./components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const interSans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Brainvault | AI Page Summaries",
    template: "%s | Brainvault",
  },
  description:
    "Turn long web pages into clear, detailed summaries with Brainvault. Read less, understand more.",
  applicationName: "Brainvault",
  authors: [{ name: "Brainvault" }],
  creator: "Brainvault",
  publisher: "Brainvault",
  keywords: [
    "Brainvault",
    "AI summarizer",
    "web page summaries",
    "article summaries",
    "Gemini",
  ],
  referrer: "origin-when-cross-origin",
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Brainvault",
    title: "Brainvault | AI Page Summaries",
    description:
      "Turn long web pages into clear, detailed summaries with Brainvault. Read less, understand more.",
  },
  twitter: {
    card: "summary",
    title: "Brainvault | AI Page Summaries",
    description:
      "Turn long web pages into clear, detailed summaries with Brainvault. Read less, understand more.",
  },
};

export const viewport: Viewport = {
  themeColor: "#f96600",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${interSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
