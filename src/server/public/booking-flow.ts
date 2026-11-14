import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { salons, services, stylists } from "@/db/schema";
import { localDateKey, localTimeKey, zonedLocalToIso } from "@/lib/format/datetime";
import { BOOKING_RULES } from "../bookings/rules";
import { listOfferings, type Offering } from "./details";
import { getAvailableSlots, getWorkingDays, resolveBookingContext, type BookingContext } from "./slots";
import { salonIsPublic, stylistIsPublic } from "./visibility";

/** تعداد روزهای قابل انتخاب در مرحله تاریخ */
export const BOOKING_DAYS = Math.min(14, BOOKING_RULES.maxAdvanceDays);

export type BookingStep = "start" | "service" | "stylist" | "date" | "time" | "confirm";

export interface BookingParams {
  salon?: string;
  stylist?: string;
  service?: string;
  date?: string;
  time?: string;
}

export interface BookingDay {
  key: string;
  dow: number;
  /** روز کاری آرایشگر در این محل */
  open: boolean;
  /** روز کاری که هیچ زمان آزادی ندارد (تکمیل یا ساعت کاری امروز گذشته) — فقط در مرحله تاریخ محاسبه می‌شود */
  full?: boolean;
}

export interface ServiceChoice {
  serviceId: string;
  serviceName: string;
  description: string | null;
  categoryLabel: string | null;
  minPrice: number;
  maxPrice: number;
  minDuration: number;
  maxDuration: number;
  stylistCount: number;
  salonName: string | null;
  salonSlug: string | null;
}

export interface BookingFlow {
  step: BookingStep;
  /** پیوند نامعتبر یا ناموجود (پیام برای کاربر) */
  notice?: string;
  salon: { id: string; name: string; slug: string; address: string; city: string } | null;
  stylist: { id: string; name: string; slug: string } | null;
  services: ServiceChoice[];
  stylistChoices: Offering[];
  ctx: BookingContext | null;
  days: BookingDay[];
  date: string | null;
  slots: Date[];
  time: string | null;
  startsAt: Date | null;
}

const str = (v: unknown) => (typeof v === "string" && v.length <= 100 ? v : undefined);

/** پارامترهای URL (فقط رشته‌های کوتاه؛ بقیه نادیده) */
export function parseBookingParams(raw: Record<string, string | string[] | undefined>): BookingParams {
  return { salon: str(raw.salon), stylist: str(raw.stylist), service: str(raw.service), date: str(raw.date), time: str(raw.time) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function groupServices(offerings: Offering[]): ServiceChoice[] {
  const map = new Map<string, Offering[]>();
  for (const o of offerings) map.set(o.serviceId, [...(map.get(o.serviceId) ?? []), o]);
  return [...map.values()].map((g) => {
    const o = g[0]!;
    const prices = g.map((x) => x.priceToman);
    const durations = g.map((x) => x.durationMinutes);
    return {
      serviceId: o.serviceId,
      serviceName: o.serviceName,
      description: o.description,
      categoryLabel: o.categoryLabel,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      stylistCount: new Set(g.map((x) => x.stylistId)).size,
      salonName: o.salonName,
      salonSlug: o.salonSlug,
    };
  });
}

/** روزهای قابل انتخاب به وقت محلی محل خدمت؛ روزهای بدون شیفت بسته‌اند */
export function bookingDays(now: Date, timezone: string, workingDays: Set<number>): BookingDay[] {
  const days: BookingDay[] = [];
  for (let i = 0; i < BOOKING_DAYS; i++) {
    const key = localDateKey(new Date(now.getTime() + i * 86_400_000), timezone);
    if (days.some((d) => d.key === key)) continue;
    const dow = new Date(`${key}T12:00:00Z`).getUTCDay();
    days.push({ key, dow, open: workingDays.has(dow) });
  }
  return days;
}

/**
 * وضعیت فرایند رزرو مرحله‌به‌مرحله از روی پارامترهای URL.
 * هر انتخاب دوباره از دیتابیس اعتبارسنجی می‌شود (فقط سالن/آرایشگر عمومی، ترکیب معتبر خدمت و آرایشگر،
 * روزهای مجاز و زمان‌هایی که واقعاً آزادند). ثبت نهایی با createBooking در تراکنش انجام می‌شود.
 */
export async function resolveBookingFlow(db: DbOrTx, p: BookingParams, opts: { now: Date; customerId?: string }): Promise<BookingFlow> {
  const flow: BookingFlow = { step: "start", salon: null, stylist: null, services: [], stylistChoices: [], ctx: null, days: [], date: null, slots: [], time: null, startsAt: null };

  if (p.salon) {
    const [s] = await db.select({ id: salons.id, name: salons.name, slug: salons.slug, address: salons.address, city: salons.city }).from(salons).where(and(eq(salons.slug, p.salon), salonIsPublic)).limit(1);
    if (!s) return { ...flow, notice: "سالن انتخاب‌شده پیدا نشد یا در حال حاضر نوبت نمی‌پذیرد." };
    flow.salon = s;
  }
  if (p.stylist) {
    const [s] = await db.select({ id: stylists.id, name: stylists.displayName, slug: stylists.slug }).from(stylists).where(and(eq(stylists.slug, p.stylist), stylistIsPublic)).limit(1);
    if (!s) return { ...flow, notice: "آرایشگر انتخاب‌شده پیدا نشد یا در حال حاضر نوبت نمی‌پذیرد." };
    flow.stylist = s;
  }
  if (!flow.salon && !flow.stylist) return flow;

  // در سالن: همه آرایشگران سالن (برای امکان تغییر آرایشگر)؛ بدون سالن: فقط همین آرایشگر
  const offerings = await listOfferings(db, flow.salon ? eq(services.salonId, flow.salon.id) : eq(stylists.id, flow.stylist!.id));
  const scoped = flow.stylist ? offerings.filter((o) => o.stylistId === flow.stylist!.id) : offerings;
  flow.services = groupServices(scoped);

  // ---- خدمت ----
  const forService = p.service && UUID.test(p.service) ? scoped.filter((o) => o.serviceId === p.service) : [];
  if (forService.length === 0) {
    if (flow.services.length === 0) return { ...flow, step: "service", notice: "در حال حاضر خدمت قابل رزروی برای این انتخاب وجود ندارد." };
    return { ...flow, step: "service", notice: p.service ? "خدمت انتخاب‌شده در دسترس نیست. لطفاً خدمت دیگری انتخاب کنید." : undefined };
  }
  flow.stylistChoices = offerings.filter((o) => o.serviceId === p.service);

  // ---- آرایشگر (اگر فقط یک نفر این خدمت را ارائه دهد، خودکار انتخاب می‌شود) ----
  const chosen = flow.stylist ? forService.find((o) => o.stylistId === flow.stylist!.id) : forService.length === 1 ? forService[0] : undefined;
  if (!chosen) return { ...flow, step: "stylist" };
  if (!flow.stylist) flow.stylist = { id: chosen.stylistId, name: chosen.stylistName, slug: chosen.stylistSlug };

  const ctx = await resolveBookingContext(db, chosen.stylistId, chosen.serviceId);
  if (!ctx) return { ...flow, step: "service", notice: "این خدمت در حال حاضر قابل رزرو نیست." };
  flow.ctx = ctx;
  if (!flow.salon && ctx.salonId) {
    const [s] = await db.select({ id: salons.id, name: salons.name, slug: salons.slug, address: salons.address, city: salons.city }).from(salons).where(eq(salons.id, ctx.salonId)).limit(1);
    flow.salon = s ?? null;
  }

  // ---- تاریخ ----
  flow.days = bookingDays(opts.now, ctx.timezone, await getWorkingDays(db, ctx));
  const day = flow.days.find((d) => d.key === p.date && d.open);
  if (!day) {
    // در مرحله انتخاب تاریخ، روزهایی که دیگر زمان آزاد ندارند «تکمیل» نمایش داده می‌شوند
    const counts = await Promise.all(
      flow.days.map((d) => (d.open ? getAvailableSlots(db, ctx, d.key, { now: opts.now, customerId: opts.customerId }).then((s) => s.length) : Promise.resolve(0))),
    );
    flow.days = flow.days.map((d, i) => (d.open ? { ...d, full: counts[i] === 0 } : d));
    return { ...flow, step: "date", notice: p.date ? "روز انتخاب‌شده قابل رزرو نیست. روز دیگری انتخاب کنید." : undefined };
  }
  flow.date = day.key;

  // ---- ساعت ----
  flow.slots = await getAvailableSlots(db, ctx, day.key, { now: opts.now, customerId: opts.customerId });
  if (!p.time) return { ...flow, step: "time" };
  const slot = /^\d{2}:\d{2}$/.test(p.time) ? flow.slots.find((s) => localTimeKey(s, ctx.timezone) === p.time) : undefined;
  if (!slot) return { ...flow, step: "time", notice: "این زمان دیگر آزاد نیست. لطفاً زمان دیگری انتخاب کنید." };
  // سازگاری تبدیل ساعت محلی ← لحظه مطلق با موتور زمان‌ها
  if (new Date(zonedLocalToIso(day.key, p.time, ctx.timezone)).getTime() !== slot.getTime()) {
    return { ...flow, step: "time", notice: "زمان انتخاب‌شده معتبر نیست." };
  }
  return { ...flow, step: "confirm", time: p.time, startsAt: slot };
}
