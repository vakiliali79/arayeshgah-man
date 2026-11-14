import type { MetadataRoute } from "next";
import { db } from "@/db";
import { salons, stylists } from "@/db/schema";
import { siteConfig } from "@/config/site";
import { salonIsPublic, stylistIsPublic } from "@/server/public/visibility";

export const dynamic = "force-dynamic";

const STATIC = ["/", "/salons", "/stylists", "/about", "/contact", "/careers", "/businesses", "/register-salon", "/join-as-stylist", "/pricing", "/support", "/faq", "/terms", "/privacy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/$/, "");
  const [s, st] = await Promise.all([
    db.select({ slug: salons.slug, updatedAt: salons.updatedAt }).from(salons).where(salonIsPublic),
    db.select({ slug: stylists.slug, updatedAt: stylists.updatedAt }).from(stylists).where(stylistIsPublic),
  ]);
  return [
    ...STATIC.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "/" ? 1 : 0.6 })),
    ...s.map((x) => ({ url: `${base}/salons/${x.slug}`, lastModified: x.updatedAt, priority: 0.8 })),
    ...st.map((x) => ({ url: `${base}/stylists/${x.slug}`, lastModified: x.updatedAt, priority: 0.7 })),
  ];
}
