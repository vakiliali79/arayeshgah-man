import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

/** متادیتای استاندارد صفحات عمومی (عنوان، توضیح، canonical، Open Graph، Twitter) */
export function pageMetadata(title: string, description: string, path: string, extra: Partial<Metadata> = {}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: `${title} | ${siteConfig.name}`, description, url: path, siteName: siteConfig.name, locale: siteConfig.locale, type: "website", images: [{ url: "/og-image.png", width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: `${title} | ${siteConfig.name}`, description, images: ["/og-image.png"] },
    ...extra,
  };
}
