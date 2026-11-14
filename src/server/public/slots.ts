import { and, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { salonMembers, salons, services, stylistServices, stylists } from "@/db/schema";
import { BOOKING_RULES } from "../bookings/rules";

/** گام نمایش زمان‌های قابل رزرو (دقیقه) */
export const SLOT_STEP_MINUTES = 15;

export interface BookingContext {
  stylistId: string;
  stylistUserId: string;
  stylistName: string;
  stylistSlug: string;
  serviceId: string;
  serviceName: string;
  salonId: string | null;
  salonName: string | null;
  salonSlug: string | null;
  salonAddress: string | null;
  timezone: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceToman: number;
}

/**
 * ترکیب معتبر آرایشگر + خدمت برای رزرو عمومی (همان قواعد createBooking):
 * خدمت و تخصیص فعال؛ خدمت سالن ← سالن فعال و تأییدشده و آرایشگر عضو فعال؛ خدمت مستقل ← پذیرش نوبت مستقل.
 */
export async function resolveBookingContext(db: DbOrTx, stylistId: string, serviceId: string): Promise<BookingContext | null> {
  const [row] = await db
    .select({ st: stylists, svc: services, asg: stylistServices })
    .from(stylistServices)
    .innerJoin(stylists, eq(stylists.id, stylistServices.stylistId))
    .innerJoin(services, eq(services.id, stylistServices.serviceId))
    .where(and(eq(stylistServices.stylistId, stylistId), eq(stylistServices.serviceId, serviceId), eq(stylistServices.isActive, true), eq(services.isActive, true), eq(stylists.isActive, true)))
    .limit(1);
  if (!row) return null;
  const { st, svc, asg } = row;
  let salon: typeof salons.$inferSelect | null = null;
  if (svc.salonId) {
    const [s] = await db.select().from(salons).where(and(eq(salons.id, svc.salonId), eq(salons.isActive, true), eq(salons.isVerified, true))).limit(1);
    if (!s) return null;
    const [m] = await db
      .select({ id: salonMembers.id })
      .from(salonMembers)
      .where(and(eq(salonMembers.salonId, s.id), eq(salonMembers.userId, st.userId), eq(salonMembers.status, "active"), eq(salonMembers.role, "stylist")))
      .limit(1);
    if (!m) return null;
    salon = s;
  } else if (svc.stylistId !== st.id || !st.acceptsIndependentBookings) {
    return null;
  }
  return {
    stylistId: st.id, stylistUserId: st.userId, stylistName: st.displayName, stylistSlug: st.slug,
    serviceId: svc.id, serviceName: svc.name,
    salonId: salon?.id ?? null, salonName: salon?.name ?? null, salonSlug: salon?.slug ?? null, salonAddress: salon?.address ?? null,
    timezone: salon?.timezone ?? st.timezone,
    durationMinutes: asg.customDurationMinutes ?? svc.durationMinutes,
    bufferMinutes: svc.bufferMinutes,
    priceToman: asg.customPriceToman ?? svc.priceToman,
  };
}

/**
 * زمان‌های آزاد یک روز محلی (YYYY-MM-DD) برای این آرایشگر/خدمت.
 * همه شرط‌ها در یک کوئری: شیفت آرایشگر، ساعات سالن، نوبت‌های فعال (با زمان آماده‌سازی)،
 * تعطیلی‌ها، حداقل فاصله از اکنون؛ اگر customerId داده شود، تداخل با نوبت‌های خود مشتری هم حذف می‌شود.
 */
export async function getAvailableSlots(db: DbOrTx, ctx: BookingContext, date: string, opts: { now?: Date; customerId?: string } = {}): Promise<Date[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const now = opts.now ?? new Date();
  const minStart = new Date(now.getTime() + BOOKING_RULES.minLeadMinutes * 60_000);
  const maxStart = new Date(now.getTime() + BOOKING_RULES.maxAdvanceDays * 86_400_000);
  const dur = ctx.durationMinutes;
  const block = ctx.durationMinutes + ctx.bufferMinutes;
  const salonCond = ctx.salonId ? sql`wh.salon_id = ${ctx.salonId}::uuid` : sql`wh.salon_id is null`;

  const res = await db.execute<{ starts: Date }>(sql`
    with p as (select ${date}::date as d, ${ctx.timezone}::text as tz),
    cands as (
      select distinct gs as ls
      from working_hours wh, p,
        lateral generate_series(p.d + wh.opens_at, p.d + wh.closes_at - make_interval(mins => ${dur}::int), make_interval(mins => ${SLOT_STEP_MINUTES}::int)) gs
      where wh.stylist_id = ${ctx.stylistId}::uuid and ${salonCond} and wh.day_of_week = extract(dow from p.d)::int
    )
    select (c.ls at time zone p.tz) as starts
    from cands c, p
    where (c.ls at time zone p.tz) >= ${minStart.toISOString()}::timestamptz
      and (c.ls at time zone p.tz) <= ${maxStart.toISOString()}::timestamptz
      and extract(minute from c.ls)::int % ${BOOKING_RULES.slotGranularityMinutes}::int = 0
      ${ctx.salonId ? sql`and exists (
        select 1 from working_hours sw where sw.salon_id = ${ctx.salonId}::uuid and sw.stylist_id is null
          and sw.day_of_week = extract(dow from p.d)::int
          and p.d + sw.opens_at <= c.ls and c.ls + make_interval(mins => ${dur}::int) <= p.d + sw.closes_at)` : sql``}
      and not exists (
        select 1 from bookings b where b.stylist_id = ${ctx.stylistId}::uuid and b.status in ('pending', 'confirmed')
          and tstzrange(b.starts_at, b.blocked_until, '[)') && tstzrange(c.ls at time zone p.tz, (c.ls + make_interval(mins => ${block}::int)) at time zone p.tz, '[)'))
      and not exists (
        select 1 from working_time_off t
        where tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(c.ls at time zone p.tz, (c.ls + make_interval(mins => ${block}::int)) at time zone p.tz, '[)')
          and ${ctx.salonId
            ? sql`((t.salon_id = ${ctx.salonId}::uuid and t.stylist_id is null) or (t.stylist_id = ${ctx.stylistId}::uuid and (t.salon_id is null or t.salon_id = ${ctx.salonId}::uuid)))`
            : sql`(t.stylist_id = ${ctx.stylistId}::uuid and t.salon_id is null)`})
      ${opts.customerId ? sql`and not exists (
        select 1 from bookings cb where cb.customer_id = ${opts.customerId}::uuid and cb.status in ('pending', 'confirmed')
          and tstzrange(cb.starts_at, cb.ends_at, '[)') && tstzrange(c.ls at time zone p.tz, (c.ls + make_interval(mins => ${dur}::int)) at time zone p.tz, '[)'))` : sql``}
    order by 1
  `);
  return res.rows.map((r) => new Date(r.starts));
}

/** روزهای هفته‌ای که آرایشگر در این محل شیفت دارد (برای غیرفعال کردن روزهای بسته در انتخاب تاریخ) */
export async function getWorkingDays(db: DbOrTx, ctx: BookingContext): Promise<Set<number>> {
  const res = await db.execute<{ dow: number }>(sql`
    select distinct day_of_week::int as dow from working_hours
    where stylist_id = ${ctx.stylistId}::uuid and ${ctx.salonId ? sql`salon_id = ${ctx.salonId}::uuid` : sql`salon_id is null`}`);
  return new Set(res.rows.map((r) => Number(r.dow)));
}

/**
 * «زمان آزاد در n روز آینده» برای فیلتر جستجو: آیا دست‌کم یک بازه آزاد به اندازه کوتاه‌ترین خدمت
 * (با گام ۳۰ دقیقه) برای یک آرایشگر/محل وجود دارد؟ خروجی: شناسه سالن‌ها یا آرایشگرانی که زمان آزاد دارند.
 */
export function availabilityExistsSql(kind: "salon" | "stylist", days = 7) {
  const outer = kind === "salon" ? sql`sa.id = "salons"."id"` : sql`st.id = "stylists"."id"`;
  return sql`exists (
    select 1
    from stylists st
    join stylist_services ss on ss.stylist_id = st.id and ss.is_active
    join services sv on sv.id = ss.service_id and sv.is_active
    left join salons sa on sa.id = sv.salon_id
    join working_hours wh on wh.stylist_id = st.id and wh.salon_id is not distinct from sv.salon_id
    cross join lateral (select coalesce(sa.timezone, st.timezone) as tz, coalesce(ss.custom_duration_minutes, sv.duration_minutes) as dur) z
    cross join lateral generate_series(0, ${days - 1}::int) dd(i)
    cross join lateral (select (now() at time zone z.tz)::date + dd.i as d) dt
    cross join lateral generate_series(dt.d + wh.opens_at, dt.d + wh.closes_at - make_interval(mins => z.dur), interval '30 minutes') gs(ls)
    where ${outer} and st.is_active
      and wh.day_of_week = extract(dow from dt.d)::int
      and (sv.salon_id is null and st.accepts_independent_bookings and sv.stylist_id = st.id
        or (sa.is_active and sa.is_verified and exists (select 1 from salon_members sm where sm.salon_id = sa.id and sm.user_id = st.user_id and sm.status = 'active' and sm.role = 'stylist')
            and exists (select 1 from working_hours sw where sw.salon_id = sa.id and sw.stylist_id is null and sw.day_of_week = wh.day_of_week
              and dt.d + sw.opens_at <= gs.ls and gs.ls + make_interval(mins => z.dur) <= dt.d + sw.closes_at)))
      and (gs.ls at time zone z.tz) > now() + interval '15 minutes'
      and not exists (select 1 from bookings b where b.stylist_id = st.id and b.status in ('pending','confirmed')
        and tstzrange(b.starts_at, b.blocked_until, '[)') && tstzrange(gs.ls at time zone z.tz, (gs.ls + make_interval(mins => z.dur + sv.buffer_minutes)) at time zone z.tz, '[)'))
      and not exists (select 1 from working_time_off t where tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(gs.ls at time zone z.tz, (gs.ls + make_interval(mins => z.dur)) at time zone z.tz, '[)')
        and ((sa.id is not null and t.salon_id = sa.id and t.stylist_id is null) or (t.stylist_id = st.id and (t.salon_id is null or t.salon_id is not distinct from sa.id))))
  )`;
}
