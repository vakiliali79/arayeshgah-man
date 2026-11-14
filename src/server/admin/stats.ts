import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import type { Actor } from "../auth/actor";
import { assertAdmin } from "./audit";

const TZ = "Asia/Tehran";
const DAY = 86_400_000;

export interface DateRange {
  /** تاریخ محلی YYYY-MM-DD (شامل) */
  from: string;
  /** تاریخ محلی YYYY-MM-DD (شامل) */
  to: string;
  unit: "day" | "week";
}

export const RANGE_PRESETS = { "7": "۷ روز اخیر", "30": "۳۰ روز اخیر", "90": "۹۰ روز اخیر", "365": "یک سال اخیر" } as const;

const localKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * بازه گزارش از پارامترهای آدرس: preset (۷/۳۰/۹۰/۳۶۵ روز) یا from/to دلخواه.
 * بازه نامعتبر یا بیش از ۲ سال به ۳۰ روز اخیر برمی‌گردد. تا ۶۲ روز روزانه، بیشتر هفتگی (هفته از شنبه).
 */
export function parseRange(sp: { range?: unknown; from?: unknown; to?: unknown }, now: Date): DateRange & { preset: string | null } {
  const today = localKey(now);
  let from: string | null = null;
  let to: string | null = null;
  let preset: string | null = null;
  if (typeof sp.from === "string" && typeof sp.to === "string" && DATE_RE.test(sp.from) && DATE_RE.test(sp.to)) {
    const f = Date.parse(`${sp.from}T00:00:00Z`);
    const t = Date.parse(`${sp.to}T00:00:00Z`);
    if (!Number.isNaN(f) && !Number.isNaN(t) && f <= t && t - f <= 731 * DAY) [from, to] = [sp.from, sp.to];
  }
  if (!from || !to) {
    preset = typeof sp.range === "string" && sp.range in RANGE_PRESETS ? sp.range : "30";
    to = today;
    from = localKey(new Date(now.getTime() - (Number(preset) - 1) * DAY));
  }
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY + 1;
  return { from, to, unit: span <= 62 ? "day" : "week", preset };
}

export type DashboardTotals = {
  users: number;
  customers: number;
  stylists: number;
  salon_owners: number;
  admins: number;
  suspended: number;
  stylist_profiles: number;
  salons: number;
  salons_verified: number;
  salons_pending: number;
  salons_rejected: number;
  salons_inactive: number;
  bookings: number;
  bookings_today: number;
  bookings_pending: number;
  bookings_completed: number;
  bookings_cancelled: number;
  services: number;
  services_active: number;
  tickets: number;
  tickets_open: number;
  reports_open: number;
};

export type SeriesPoint = {
  bucket: string;
  users: number;
  salons: number;
  bookings: number;
  active: number;
};

/** داشبورد مدیریت: شمارنده‌های کلی + سری زمانی بازه انتخابی (همه از دیتابیس) */
export async function getAdminDashboard(db: DbOrTx, actor: Actor, range: DateRange, now: Date = new Date()) {
  assertAdmin(actor);
  // تاریخ‌ها در SQL خام (sql.raw) استفاده می‌شوند؛ فقط قالب دقیق YYYY-MM-DD پذیرفته می‌شود
  if (!DATE_RE.test(range.from) || !DATE_RE.test(range.to) || (range.unit !== "day" && range.unit !== "week")) throw new Error("Invalid report range");
  const today = localKey(now);

  const totals = (
    await db.execute<DashboardTotals>(sql`
      select
        (select count(*) from users)::int as users,
        (select count(*) from profiles where role = 'customer')::int as customers,
        (select count(*) from profiles where role = 'stylist')::int as stylists,
        (select count(*) from profiles where role = 'salon_owner')::int as salon_owners,
        (select count(*) from profiles where role = 'admin')::int as admins,
        (select count(*) from profiles where status = 'suspended')::int as suspended,
        (select count(*) from stylists)::int as stylist_profiles,
        (select count(*) from salons)::int as salons,
        (select count(*) from salons where is_active and is_verified)::int as salons_verified,
        (select count(*) from salons where is_active and not is_verified and rejection_reason is null)::int as salons_pending,
        (select count(*) from salons where is_active and not is_verified and rejection_reason is not null)::int as salons_rejected,
        (select count(*) from salons where not is_active)::int as salons_inactive,
        (select count(*) from bookings)::int as bookings,
        (select count(*) from bookings where (starts_at at time zone timezone)::date = ${today}::date and status in ('pending','confirmed','completed','no_show'))::int as bookings_today,
        (select count(*) from bookings where status = 'pending')::int as bookings_pending,
        (select count(*) from bookings where status = 'completed')::int as bookings_completed,
        (select count(*) from bookings where status = 'cancelled')::int as bookings_cancelled,
        (select count(*) from services)::int as services,
        (select count(*) from services where is_active)::int as services_active,
        (select count(*) from support_tickets)::int as tickets,
        (select count(*) from support_tickets where status in ('open','in_progress'))::int as tickets_open,
        (select count(*) from support_tickets where kind = 'review_report' and status in ('open','in_progress'))::int as reports_open
    `)
  ).rows[0]!;

  // بازه دقیق تاریخ‌های انتخاب‌شده (نیمه‌شب تهران)؛ سطل‌ها روزانه یا هفتگی (هفته از شنبه)
  const bounds = sql`q as (
    select (${range.from}::date::timestamp at time zone ${TZ}) as lo,
           ((${range.to}::date + 1)::timestamp at time zone ${TZ}) as hi
  )`;
  const week = range.unit === "week";
  const bucketOf = (dateExpr: string) => (week ? `(${dateExpr} - ((extract(dow from ${dateExpr})::int + 1) % 7))` : dateExpr);
  const bucket = (col: string) => sql.raw(bucketOf(`(${col} at time zone '${TZ}')::date`));
  const first = sql.raw(bucketOf(`'${range.from}'::date`));
  const last = sql.raw(bucketOf(`'${range.to}'::date`));

  const series = (
    await db.execute<SeriesPoint>(sql`
      with ${bounds},
      b as (select gs::date as d from generate_series(${first}::timestamp, ${last}::timestamp, ${week ? sql`interval '7 days'` : sql`interval '1 day'`}) gs),
      u as (select ${bucket("x.created_at")} as d, count(*) as n from users x, q where x.created_at >= q.lo and x.created_at < q.hi group by 1),
      s as (select ${bucket("x.created_at")} as d, count(*) as n from salons x, q where x.created_at >= q.lo and x.created_at < q.hi group by 1),
      k as (select ${bucket("x.created_at")} as d, count(*) as n from bookings x, q where x.created_at >= q.lo and x.created_at < q.hi group by 1),
      a as (
        select ${bucket("e.at")} as d, count(distinct e.uid) as n
        from (
          select customer_id as uid, created_at as at from bookings
          union all select customer_id, created_at from reviews
          union all select user_id, created_at from support_tickets where user_id is not null
        ) e, q
        where e.at >= q.lo and e.at < q.hi group by 1
      )
      select to_char(b.d, 'YYYY-MM-DD') as bucket,
        coalesce(u.n, 0)::int as users, coalesce(s.n, 0)::int as salons, coalesce(k.n, 0)::int as bookings, coalesce(a.n, 0)::int as active
      from b left join u on u.d = b.d left join s on s.d = b.d left join k on k.d = b.d left join a on a.d = b.d
      order by b.d
    `)
  ).rows;

  const byStatus = (
    await db.execute<{ status: string; n: number }>(sql`
      with ${bounds}
      select x.status::text as status, count(*)::int as n from bookings x, q
      where x.created_at >= q.lo and x.created_at < q.hi group by 1 order by 2 desc
    `)
  ).rows;

  return { totals, series, byStatus };
}
