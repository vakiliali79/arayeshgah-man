import { and, eq, isNull, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { workingHours, workingTimeOff } from "@/db/schema";

/**
 * بررسی‌های زمانی با PostgreSQL انجام می‌شود تا تبدیل منطقه زمانی (AT TIME ZONE)
 * و تغییر ساعت تابستانی دقیق و یکسان باشد. ساعات کاری «ساعت محلی» هستند،
 * نوبت‌ها و تعطیلی‌ها بازه مطلق timestamptz.
 *
 * شرط: کل بازه [start, end) داخل یک شیفت همان روز محلی قرار بگیرد.
 */
function withinShift(start: Date, end: Date, tz: string) {
  const localStart = sql`(${start.toISOString()}::timestamptz at time zone ${tz})`;
  const localEnd = sql`(${end.toISOString()}::timestamptz at time zone ${tz})`;
  return and(
    sql`${workingHours.dayOfWeek} = extract(dow from ${localStart})::int`,
    sql`(${localStart}::date + ${workingHours.opensAt}) <= ${localStart}`,
    sql`${localEnd} <= (${localStart}::date + ${workingHours.closesAt})`,
  );
}

/** آیا سالن در کل بازه باز است؟ */
export async function isSalonOpen(db: DbOrTx, salonId: string, start: Date, end: Date, tz: string) {
  const rows = await db
    .select({ id: workingHours.id })
    .from(workingHours)
    .where(and(eq(workingHours.salonId, salonId), isNull(workingHours.stylistId), withinShift(start, end, tz)))
    .limit(1);
  return rows.length > 0;
}

/**
 * آیا آرایشگر در کل بازه شیفت دارد؟
 * salonId = null یعنی ساعات کاری مستقل آرایشگر.
 */
export async function isStylistWorking(db: DbOrTx, stylistId: string, salonId: string | null, start: Date, end: Date, tz: string) {
  const rows = await db
    .select({ id: workingHours.id })
    .from(workingHours)
    .where(
      and(
        eq(workingHours.stylistId, stylistId),
        salonId ? eq(workingHours.salonId, salonId) : isNull(workingHours.salonId),
        withinShift(start, end, tz),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * آیا تعطیلی/مرخصی با بازه هم‌پوشانی دارد؟
 * شامل: تعطیلی کل سالن، مرخصی سراسری آرایشگر، و مرخصی آرایشگر در همین سالن.
 */
export async function hasTimeOffConflict(db: DbOrTx, stylistId: string, salonId: string | null, start: Date, end: Date) {
  const overlaps = sql`tstzrange(${workingTimeOff.startsAt}, ${workingTimeOff.endsAt}, '[)') && tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, '[)')`;
  const scope = salonId
    ? sql`(
        (${workingTimeOff.salonId} = ${salonId} and ${workingTimeOff.stylistId} is null)
        or (${workingTimeOff.stylistId} = ${stylistId} and (${workingTimeOff.salonId} is null or ${workingTimeOff.salonId} = ${salonId}))
      )`
    : sql`(${workingTimeOff.stylistId} = ${stylistId} and ${workingTimeOff.salonId} is null)`;

  const rows = await db.select({ id: workingTimeOff.id }).from(workingTimeOff).where(and(scope, overlaps)).limit(1);
  return rows.length > 0;
}
