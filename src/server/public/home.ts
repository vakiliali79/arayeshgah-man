import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { salons, serviceCategories, stylists } from "@/db/schema";
import { salonIsPublic, stylistIsPublic } from "./visibility";

/** داده‌های صفحه اصلی — فقط داده واقعی؛ بدون عدد یا نام ساختگی */
export async function getHomeData(db: DbOrTx) {
  const [salonCount] = await db.select({ n: count() }).from(salons).where(salonIsPublic);
  const [stylistCount] = await db.select({ n: count() }).from(stylists).where(stylistIsPublic);
  const categories = await db
    .select({
      key: serviceCategories.key,
      label: serviceCategories.label,
      salons: sql<number>`(select count(distinct s.salon_id)::int from services s join salons sa on sa.id = s.salon_id where s.category = "service_categories"."key" and s.is_active and sa.is_active and sa.is_verified)`,
    })
    .from(serviceCategories)
    .where(eq(serviceCategories.isActive, true))
    .orderBy(asc(serviceCategories.sortOrder));
  const featuredSalons = await db
    .select({
      id: salons.id, name: salons.name, slug: salons.slug, city: salons.city, district: salons.district,
      ratingAvg: salons.ratingAvg, ratingCount: salons.ratingCount, coverFileId: salons.coverFileId,
      categories: sql<string[]>`coalesce((select array_agg(distinct sc.label) from services s join service_categories sc on sc.key = s.category where s.salon_id = "salons"."id" and s.is_active), '{}')`,
    })
    .from(salons)
    .where(salonIsPublic)
    .orderBy(desc(salons.ratingAvg), desc(salons.ratingCount), desc(salons.createdAt))
    .limit(4);
  const topStylists = await db
    .select({ id: stylists.id, name: stylists.displayName, slug: stylists.slug, specialties: stylists.specialties, ratingAvg: stylists.ratingAvg, ratingCount: stylists.ratingCount, independent: stylists.acceptsIndependentBookings, city: stylists.city, avatarFileId: sql<string | null>`(select p.avatar_file_id from profiles p where p.user_id = "stylists"."user_id")` })
    .from(stylists)
    .where(stylistIsPublic)
    .orderBy(desc(stylists.ratingAvg), desc(stylists.ratingCount), desc(stylists.createdAt))
    .limit(4);
  const [ratingAgg] = await db
    .select({ avg: sql<string | null>`round(avg(${salons.ratingAvg}) filter (where ${salons.ratingCount} > 0), 1)` })
    .from(salons)
    .where(and(salonIsPublic));
  return {
    salonCount: salonCount?.n ?? 0,
    stylistCount: stylistCount?.n ?? 0,
    avgRating: ratingAgg?.avg ? Number(ratingAgg.avg) : null,
    categories,
    featuredSalons,
    topStylists,
  };
}

