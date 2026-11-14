import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/api/", "/book", "/login", "/register"] }],
    sitemap: `${siteConfig.url.replace(/\/$/, "")}/sitemap.xml`,
  };
}
