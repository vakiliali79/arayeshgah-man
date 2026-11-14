import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { siteConfig } from "@/config/site";
import "./globals.css";

const vazirmatn = localFont({
  src: "../assets/fonts/Vazirmatn-Variable.woff2",
  variable: "--font-vazirmatn",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: `${siteConfig.name} | رزرو آنلاین خدمات زیبایی`, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  openGraph: { locale: siteConfig.locale, siteName: siteConfig.name, type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#5f2c4a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
