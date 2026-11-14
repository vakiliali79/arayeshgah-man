import { and, asc, count, desc, gte, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "@/db/client";
import { salons, serviceCategory, stylists } from "@/db/schema";
import { availabilityExistsSql } from "./slots";
import { salonIsPublic, stylistIsPublic } from "./visibility";

export const PAGE_SIZE = 12;
const like = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
const toInt = (v: unknown) => (v === undefined || v === "" ? undefined : Number(String(v).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))));

/** پارامترهای آدرس صفحه جستجو؛ مقادیر نامعتبر نادیده گرفته می‌شوند (خطا نمی‌دهند) */
export const searchParamsSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  city: z.string().trim().max(60).optional().catch(undefined),
  district: z.string().trim().max(60).optional().catch(undefined),
  category: z.enum(serviceCategory.enumValues).optional().catch(undefined),
  specialty: z.string().trim().max(40).optional().catch(undefined),
  minPrice: z.preprocess(toInt, z.number().int().min(0).max(1_000_000_000).optional()).catch(undefined),
  maxPrice: z.preprocess(toInt, z.number().int().min(0).max(1_000_000_000).optional()).catch(undefined),
  minRating: z.preprocess(toInt, z.number().int().min(1).max(5).optional()).catch(undefined),
  available: z.preprocess((v) => v === "1" || v === "on" || v === "true", z.boolean()).catch(false),
  sort: z.enum(["popular", "rating", "price_asc", "price_desc"]).catch("popular"),
  page: z.preprocess(toInt, z.number().int().min(1).max(500)).catch(1),
});
export type SearchParams = z.output<typeof searchParamsSchema>;

export function parseSearchParams(raw: Record<string, string | string[] | undefined>): SearchParams {
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v !== undefined && v !== ""));
  return searchParamsSchema.parse(flat);
}

/** حداقل قیمت خدمات فعال سالن (با فیلتر دسته اگر انتخاب شده) */
const salonMinPrice = (category?: string) =>
  sql<number | null>`(select min(sv.price_toman) from services sv where sv.salon_id = "salons"."id" and sv.is_active ${category ? sql`and sv.category = ${category}::service_category` : sql``})`;

export async function searchSalons(db: DbOrTx, p: SearchParams) {
  const minPrice = salonMinPrice(p.category);
  const cond: SQL[] = [salonIsPublic!];
  if (p.q) cond.push(sql`("salons"."name" ilike ${like(p.q)} or exists (select 1 from services sv where sv.salon_id = "salons"."id" and sv.is_active and sv.name ilike ${like(p.q)}))`);
  if (p.city) cond.push(sql`"salons"."city" ilike ${like(p.city)}`);
  if (p.district) cond.push(sql`("salons"."district" ilike ${like(p.district)} or "salons"."address" ilike ${like(p.district)})`);
  if (p.category) cond.push(sql`exists (select 1 from services sv where sv.salon_id = "salons"."id" and sv.is_active and sv.category = ${p.category}::service_category)`);
  if (p.minPrice !== undefined || p.maxPrice !== undefined) {
    cond.push(sql`exists (select 1 from services sv where sv.salon_id = "salons"."id" and sv.is_active
      ${p.category ? sql`and sv.category = ${p.category}::service_category` : sql``}
      ${p.minPrice !== undefined ? sql`and sv.price_toman >= ${p.minPrice}` : sql``}
      ${p.maxPrice !== undefined ? sql`and sv.price_toman <= ${p.maxPrice}` : sql``})`);
  }
  if (p.minRating) cond.push(gte(salons.ratingAvg, p.minRating));
  if (p.available) cond.push(availabilityExistsSql("salon"));
  const where = and(...cond);

  const order =
    p.sort === "rating" ? [desc(salons.ratingAvg), desc(salons.ratingCount)]
    : p.sort === "price_asc" ? [sql`${minPrice} asc nulls last`]
    : p.sort === "price_desc" ? [sql`${minPrice} desc nulls last`]
    : [desc(sql`(select count(*) from bookings b where b.salon_id = "salons"."id" and b.status in ('completed','confirmed'))`), desc(salons.ratingCount), desc(salons.ratingAvg)];

  const [total] = await db.select({ n: count() }).from(salons).where(where);
  const rows = await db
    .select({
      id: salons.id, name: salons.name, slug: salons.slug, city: salons.city, district: salons.district,
      ratingAvg: salons.ratingAvg, ratingCount: salons.ratingCount, coverFileId: salons.coverFileId, minPrice,
      categories: sql<string[]>`coalesce((select array_agg(distinct sc.label) from services sv join service_categories sc on sc.key = sv.category where sv.salon_id = "salons"."id" and sv.is_active), '{}')`,
    })
    .from(salons)
    .where(where)
    .orderBy(...order, asc(salons.name))
    .limit(PAGE_SIZE)
    .offset((p.page - 1) * PAGE_SIZE);
  return { total: total?.n ?? 0, rows: rows.map((r) => ({ ...r, minPrice: r.minPrice === null ? null : Number(r.minPrice) })) };
}

/** قیمت مؤثر خدمات قابل رزرو آرایشگر (قیمت اختصاصی یا پایه) */
const stylistOfferSql = (extra: SQL) => sql`exists (
  select 1 from stylist_services ss join services sv on sv.id = ss.service_id
  left join salons sa on sa.id = sv.salon_id
  where ss.stylist_id = "stylists"."id" and ss.is_active and sv.is_active
    and (sv.salon_id is null and "stylists"."accepts_independent_bookings" or sa.is_active and sa.is_verified)
    ${extra})`;

export async function searchStylists(db: DbOrTx, p: SearchParams) {
  const minPrice = sql<number | null>`(select min(coalesce(ss.custom_price_toman, sv.price_toman)) from stylist_services ss join services sv on sv.id = ss.service_id
    left join salons sa on sa.id = sv.salon_id
    where ss.stylist_id = "stylists"."id" and ss.is_active and sv.is_active and (sv.salon_id is null and "stylists"."accepts_independent_bookings" or sa.is_active and sa.is_verified)
    ${p.category ? sql`and sv.category = ${p.category}::service_category` : sql``})`;
  const salonCity = (field: "city" | "district", v: string) =>
    sql`exists (select 1 from salon_members sm join salons sa on sa.id = sm.salon_id where sm.user_id = "stylists"."user_id" and sm.status = 'active' and sm.role = 'stylist' and sa.is_active and sa.is_verified and (sa.${sql.raw(field)} ilike ${like(v)}${field === "district" ? sql` or sa.address ilike ${like(v)}` : sql``}))`;

  const cond: SQL[] = [stylistIsPublic];
  if (p.q) cond.push(sql`"stylists"."display_name" ilike ${like(p.q)}`);
  if (p.specialty) cond.push(sql`exists (select 1 from unnest("stylists"."specialties") sp where sp ilike ${like(p.specialty)})`);
  if (p.city) cond.push(sql`("stylists"."city" ilike ${like(p.city)} or ${salonCity("city", p.city)})`);
  if (p.district) cond.push(sql`("stylists"."district" ilike ${like(p.district)} or ${salonCity("district", p.district)})`);
  if (p.category) cond.push(stylistOfferSql(sql`and sv.category = ${p.category}::service_category`));
  if (p.minPrice !== undefined || p.maxPrice !== undefined) {
    cond.push(stylistOfferSql(sql`
      ${p.category ? sql`and sv.category = ${p.category}::service_category` : sql``}
      ${p.minPrice !== undefined ? sql`and coalesce(ss.custom_price_toman, sv.price_toman) >= ${p.minPrice}` : sql``}
      ${p.maxPrice !== undefined ? sql`and coalesce(ss.custom_price_toman, sv.price_toman) <= ${p.maxPrice}` : sql``}`));
  }
  if (p.minRating) cond.push(gte(stylists.ratingAvg, p.minRating));
  if (p.available) cond.push(availabilityExistsSql("stylist"));
  const where = and(...cond);

  const order =
    p.sort === "rating" ? [desc(stylists.ratingAvg), desc(stylists.ratingCount)]
    : p.sort === "price_asc" ? [sql`${minPrice} asc nulls last`]
    : p.sort === "price_desc" ? [sql`${minPrice} desc nulls last`]
    : [desc(sql`(select count(*) from bookings b where b.stylist_id = "stylists"."id" and b.status in ('completed','confirmed'))`), desc(stylists.ratingCount), desc(stylists.ratingAvg)];

  const [total] = await db.select({ n: count() }).from(stylists).where(where);
  const rows = await db
    .select({
      id: stylists.id, name: stylists.displayName, slug: stylists.slug, specialties: stylists.specialties, city: stylists.city,
      ratingAvg: stylists.ratingAvg, ratingCount: stylists.ratingCount, independent: stylists.acceptsIndependentBookings, minPrice,
      avatarFileId: sql<string | null>`(select pr.avatar_file_id from profiles pr where pr.user_id = "stylists"."user_id")`,
      salonNames: sql<string[]>`coalesce((select array_agg(sa.name order by sa.name) from salon_members sm join salons sa on sa.id = sm.salon_id
        where sm.user_id = "stylists"."user_id" and sm.status = 'active' and sm.role = 'stylist' and sa.is_active and sa.is_verified), '{}')`,
    })
    .from(stylists)
    .where(where)
    .orderBy(...order, asc(stylists.displayName))
    .limit(PAGE_SIZE)
    .offset((p.page - 1) * PAGE_SIZE);
  return { total: total?.n ?? 0, rows: rows.map((r) => ({ ...r, minPrice: r.minPrice === null ? null : Number(r.minPrice) })) };
}
