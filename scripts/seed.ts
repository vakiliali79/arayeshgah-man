/**
 * داده‌های نمونه توسعه.  npm run db:seed
 *
 * - همه داده‌های موجود را پاک می‌کند (TRUNCATE) — فقط روی دیتابیس محلی و غیر production اجرا می‌شود.
 * - تا حد ممکن از سرویس‌های واقعی دامنه استفاده می‌کند تا داده‌ها همان اعتبارسنجی‌های برنامه را پاس کنند.
 * - ورود با شماره موبایل و OTP؛ در توسعه کد ثابت AUTH_STATIC_OTP (پیش‌فرض 1111)
 */
import { assertSafeLocalDatabase, requireEnv } from "./env";
import { sql } from "drizzle-orm";
import { createDb, type Database } from "../src/db/client";
import { favorites, profiles, users } from "../src/db/schema";
import type { UserRole } from "../src/db/types";
import type { Actor } from "../src/server/auth/actor";
import {
  cancelBooking,
  completeBooking,
  confirmBooking,
  createBooking,
} from "../src/server/bookings/service";
import { assignServiceToStylist, createService } from "../src/server/catalog/service";
import { ensureProfile } from "../src/server/profiles/service";
import { createReview } from "../src/server/reviews/service";
import { acceptSalonInvitation, createSalon, inviteSalonMember } from "../src/server/salons/service";
import { addTimeOff, addWorkingHours } from "../src/server/schedules/service";
import { createStylistProfile } from "../src/server/stylists/service";

const TZ = "Asia/Tehran";
// ایران از ۱۴۰۱ ساعت تابستانی ندارد؛ offset ثابت +03:30
const TEHRAN_OFFSET = "+03:30";

// روزهای هفته مطابق EXTRACT(DOW): ۰=یکشنبه … ۶=شنبه
const SAT = 6, SUN = 0, MON = 1, TUE = 2, WED = 3, THU = 4;

async function createUser(db: Database, u: { name: string; email: string; role: UserRole; phone: string }) {
  // هویت ورود: شماره موبایل به شکل استاندارد ‎+989XXXXXXXXX‎ (ایمیل فقط برای سازگاری با داده‌های قبلی)
  const [user] = await db
    .insert(users)
    .values({ name: u.name, email: u.email, emailVerified: true, phoneNumber: `+98${u.phone.slice(1)}`, phoneNumberVerified: true })
    .returning();
  await ensureProfile(db, { userId: user!.id, fullName: u.name });
  // تعیین نقش در seed (دسترسی مستقیم به دیتابیس) — در برنامه فقط از مسیرهای کنترل‌شده
  await db
    .update(profiles)
    .set({ role: u.role, roleSelectedAt: new Date(), phone: u.phone })
    .where(sql`${profiles.userId} = ${user!.id}`);
  return { userId: user!.id, role: u.role } satisfies Actor;
}

/** تاریخ محلی تهران (YYYY-MM-DD) n روز بعد از اکنون */
function tehranDate(daysFromNow: number): { date: string; dow: number } {
  const d = new Date(Date.now() + daysFromNow * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const dow = new Date(`${parts}T12:00:00${TEHRAN_OFFSET}`).getUTCDay();
  return { date: parts, dow };
}

/** اولین روز (از offset به بعد) با روز هفته مشخص، در ساعت محلی داده‌شده */
function nextLocal(dow: number, time: string, fromDays = 1): string {
  for (let i = fromDays; i < fromDays + 14; i++) {
    const t = tehranDate(i);
    if (t.dow === dow) return `${t.date}T${time}:00${TEHRAN_OFFSET}`;
  }
  throw new Error("unreachable");
}

async function main() {
  const url = requireEnv("DATABASE_URL");
  assertSafeLocalDatabase(url, "SEED_ALLOW_REMOTE");
  const db = createDb(url, { max: 5 });

  try {
    console.log("• truncating tables");
    await db.execute(sql`
      TRUNCATE users, sessions, accounts, verifications, profiles, files, salons, salon_members, stylists,
               services, stylist_services, working_hours, working_time_off, bookings, booking_events,
               reviews, portfolio_items, favorites, notifications
      RESTART IDENTITY CASCADE`);

    console.log("• users");
    await createUser(db, { name: "مدیر سیستم", email: "admin@arayeshgahman.local", role: "admin", phone: "09120000099" });
    const owner1 = await createUser(db, { name: "شیرین تهرانی", email: "owner.rosegold@arayeshgahman.local", role: "salon_owner", phone: "09120000001" });
    const owner2 = await createUser(db, { name: "فرزانه نیک‌نام", email: "owner.mahroo@arayeshgahman.local", role: "salon_owner", phone: "09120000002" });
    const negarU = await createUser(db, { name: "نگار احمدی", email: "negar@arayeshgahman.local", role: "stylist", phone: "09130000001" });
    const saraU = await createUser(db, { name: "سارا کریمی", email: "sara@arayeshgahman.local", role: "stylist", phone: "09130000002" });
    const maryamU = await createUser(db, { name: "مریم رضایی", email: "maryam@arayeshgahman.local", role: "stylist", phone: "09130000003" });
    const elhamU = await createUser(db, { name: "الهام موسوی", email: "elham@arayeshgahman.local", role: "stylist", phone: "09130000004" });
    const customers = await Promise.all(
      [
        ["مینا صادقی", "mina", "09350000001"],
        ["لیلا جعفری", "leila", "09350000002"],
        ["نازنین حسینی", "nazanin", "09350000003"],
        ["پریسا اکبری", "parisa", "09350000004"],
      ].map(([name, slug, phone]) =>
        createUser(db, { name: name!, email: `${slug}@example.com`, role: "customer", phone: phone! }),
      ),
    );
    const [mina, leila, nazanin, parisa] = customers as [Actor, Actor, Actor, Actor];

    console.log("• stylists");
    const negar = await createStylistProfile(db, negarU, { displayName: "نگار احمدی", bio: "متخصص رنگ، لایت و بالیاژ", specialties: ["رنگ مو", "بالیاژ"], yearsExperience: 12 });
    const sara = await createStylistProfile(db, saraU, { displayName: "سارا کریمی", bio: "میکاپ آرتیست و گریم عروس", specialties: ["میکاپ", "شینیون"], yearsExperience: 8 });
    const maryam = await createStylistProfile(db, maryamU, { displayName: "مریم رضایی", bio: "طراح و کاشت ناخن", specialties: ["کاشت ناخن", "طراحی ناخن"], yearsExperience: 6 });
    const elham = await createStylistProfile(db, elhamU, {
      displayName: "الهام موسوی",
      bio: "متخصص پوست؛ ارائه خدمات مستقل در استودیو شخصی",
      specialties: ["پاکسازی پوست", "هیدرافیشیال"],
      yearsExperience: 5,
      acceptsIndependentBookings: true,
    });

    console.log("• salons");
    const roseGold = await createSalon(db, owner1, {
      name: "سالن زیبایی رز طلایی", slug: "rose-gold", city: "تهران", address: "زعفرانیه، خیابان مقدس اردبیلی، پلاک ۱۲",
      phone: "02122000001", description: "سالن تخصصی رنگ و میکاپ عروس",
    });
    const artemis = await createSalon(db, owner1, {
      name: "استودیو آرتمیس", slug: "artemis-studio", city: "تهران", address: "سعادت‌آباد، میدان کاج، پلاک ۴",
      phone: "02122000002",
    });
    const mahroo = await createSalon(db, owner2, {
      name: "خانه زیبایی مهرو", slug: "mahroo", city: "تهران", address: "پاسداران، گلستان پنجم، پلاک ۸",
      phone: "02122000003",
    });

    console.log("• memberships (نگار عضو دو سالن است)");
    const join = async (owner: Actor, salonId: string, stylist: Actor) => {
      const m = await inviteSalonMember(db, owner, { salonId, userId: stylist.userId, role: "stylist" });
      await acceptSalonInvitation(db, stylist, m.id);
    };
    await join(owner1, roseGold.id, negarU);
    await join(owner1, roseGold.id, saraU);
    await join(owner1, artemis.id, negarU);
    await join(owner1, artemis.id, maryamU);
    await join(owner2, mahroo.id, maryamU);
    await join(owner2, mahroo.id, saraU);

    console.log("• working hours");
    for (const dow of [SAT, SUN, MON, TUE, WED, THU]) {
      await addWorkingHours(db, owner1, { salonId: roseGold.id, dayOfWeek: dow, opensAt: "10:00", closesAt: "20:00" });
      await addWorkingHours(db, owner2, { salonId: mahroo.id, dayOfWeek: dow, opensAt: "10:00", closesAt: "19:00" });
    }
    for (const dow of [SAT, SUN, MON, TUE, WED]) {
      // شیفت دوبخشی
      await addWorkingHours(db, owner1, { salonId: artemis.id, dayOfWeek: dow, opensAt: "09:00", closesAt: "13:00" });
      await addWorkingHours(db, owner1, { salonId: artemis.id, dayOfWeek: dow, opensAt: "15:00", closesAt: "21:00" });
    }
    // نگار: شنبه تا دوشنبه در رز طلایی، سه‌شنبه و چهارشنبه در آرتمیس
    for (const dow of [SAT, SUN, MON]) await addWorkingHours(db, owner1, { salonId: roseGold.id, stylistId: negar.id, dayOfWeek: dow, opensAt: "10:00", closesAt: "18:00" });
    for (const dow of [TUE, WED]) await addWorkingHours(db, owner1, { salonId: artemis.id, stylistId: negar.id, dayOfWeek: dow, opensAt: "15:00", closesAt: "21:00" });
    for (const dow of [SAT, SUN, MON, TUE, WED, THU]) await addWorkingHours(db, owner1, { salonId: roseGold.id, stylistId: sara.id, dayOfWeek: dow, opensAt: "12:00", closesAt: "20:00" });
    for (const dow of [SAT, SUN, MON, TUE, WED]) await addWorkingHours(db, owner1, { salonId: artemis.id, stylistId: maryam.id, dayOfWeek: dow, opensAt: "09:00", closesAt: "13:00" });
    for (const dow of [THU]) await addWorkingHours(db, owner2, { salonId: mahroo.id, stylistId: maryam.id, dayOfWeek: dow, opensAt: "10:00", closesAt: "19:00" });
    for (const dow of [SAT, SUN, MON, TUE, WED]) await addWorkingHours(db, elhamU, { stylistId: elham.id, dayOfWeek: dow, opensAt: "16:00", closesAt: "21:00" });

    console.log("• services");
    const svc = async (actor: Actor, values: Record<string, unknown>) => createService(db, actor, values);
    const coloring = await svc(owner1, { salonId: roseGold.id, name: "رنگ ریشه", category: "color", durationMinutes: 90, bufferMinutes: 15, priceToman: 1_800_000 });
    const balayage = await svc(owner1, { salonId: roseGold.id, name: "بالیاژ", category: "color", durationMinutes: 180, bufferMinutes: 15, priceToman: 6_500_000 });
    const bridalMakeup = await svc(owner1, { salonId: roseGold.id, name: "میکاپ عروس", category: "makeup", durationMinutes: 150, bufferMinutes: 30, priceToman: 9_000_000 });
    const artemisColor = await svc(owner1, { salonId: artemis.id, name: "لایت کامل", category: "color", durationMinutes: 120, bufferMinutes: 15, priceToman: 4_200_000 });
    const gelNails = await svc(owner1, { salonId: artemis.id, name: "کاشت ناخن ژل", category: "nail", durationMinutes: 90, bufferMinutes: 10, priceToman: 1_200_000 });
    const mahrooNails = await svc(owner2, { salonId: mahroo.id, name: "مانیکور و لاک ژل", category: "nail", durationMinutes: 60, priceToman: 750_000 });
    const mahrooMakeup = await svc(owner2, { salonId: mahroo.id, name: "میکاپ مجلسی", category: "makeup", durationMinutes: 90, bufferMinutes: 15, priceToman: 2_500_000 });
    const facial = await svc(elhamU, { stylistId: elham.id, name: "پاکسازی عمیق پوست", category: "skin", durationMinutes: 75, bufferMinutes: 15, priceToman: 1_400_000 });
    const hydra = await svc(elhamU, { stylistId: elham.id, name: "هیدرافیشیال", category: "skin", durationMinutes: 60, priceToman: 1_900_000 });

    await assignServiceToStylist(db, owner1, { stylistId: negar.id, serviceId: coloring.id, customPriceToman: 2_100_000 }); // قیمت اختصاصی نگار
    await assignServiceToStylist(db, owner1, { stylistId: negar.id, serviceId: balayage.id });
    await assignServiceToStylist(db, owner1, { stylistId: sara.id, serviceId: bridalMakeup.id });
    await assignServiceToStylist(db, owner1, { stylistId: sara.id, serviceId: coloring.id });
    await assignServiceToStylist(db, owner1, { stylistId: negar.id, serviceId: artemisColor.id });
    await assignServiceToStylist(db, owner1, { stylistId: maryam.id, serviceId: gelNails.id });
    await assignServiceToStylist(db, owner2, { stylistId: maryam.id, serviceId: mahrooNails.id });
    await assignServiceToStylist(db, owner2, { stylistId: sara.id, serviceId: mahrooMakeup.id });
    await assignServiceToStylist(db, elhamU, { stylistId: elham.id, serviceId: facial.id });
    await assignServiceToStylist(db, elhamU, { stylistId: elham.id, serviceId: hydra.id });

    console.log("• time off");
    const holiday = tehranDate(10);
    await addTimeOff(db, owner1, { salonId: roseGold.id, startsAt: `${holiday.date}T00:00:00${TEHRAN_OFFSET}`, endsAt: `${holiday.date}T23:59:00${TEHRAN_OFFSET}`, reason: "تعطیل رسمی" });
    const vacation = tehranDate(20);
    await addTimeOff(db, saraU, { stylistId: sara.id, startsAt: `${vacation.date}T00:00:00${TEHRAN_OFFSET}`, endsAt: `${tehranDate(23).date}T00:00:00${TEHRAN_OFFSET}`, reason: "مرخصی" });

    console.log("• bookings (آینده)");
    const upcoming1 = await createBooking(db, mina, { stylistId: negar.id, serviceId: coloring.id, startsAt: nextLocal(SAT, "11:00"), customerNote: "رنگ قبلی قهوه‌ای روشن" });
    await confirmBooking(db, negarU, { bookingId: upcoming1.id });
    await createBooking(db, leila, { stylistId: sara.id, serviceId: bridalMakeup.id, startsAt: nextLocal(SUN, "14:00") });
    await createBooking(db, nazanin, { stylistId: elham.id, serviceId: facial.id, startsAt: nextLocal(MON, "17:00") });
    await createBooking(db, parisa, { stylistId: maryam.id, serviceId: gelNails.id, startsAt: nextLocal(TUE, "10:00") });
    const toCancel = await createBooking(db, parisa, { stylistId: negar.id, serviceId: artemisColor.id, startsAt: nextLocal(WED, "16:00") });
    await cancelBooking(db, parisa, { bookingId: toCancel.id, reason: "تغییر برنامه سفر" });

    console.log("• bookings (گذشته، انجام‌شده + نظر)");
    // ساعت تزریقی: نوبت‌های گذشته طوری ساخته می‌شوند که انگار از قبل رزرو شده‌اند
    const pastSlots: Array<[Actor, string, string, Actor, number, string]> = [
      [mina, negar.id, coloring.id, negarU, 5, "عالی بود، رنگ دقیقاً همان چیزی شد که می‌خواستم."],
      [leila, sara.id, coloring.id, saraU, 4, "کار تمیز و دقیق، فقط کمی تأخیر داشت."],
      [nazanin, elham.id, facial.id, elhamU, 5, "محیط آرام و کار کاملاً حرفه‌ای."],
    ];
    for (const [i, [customer, stylistId, serviceId, stylistActor, rating, comment]] of pastSlots.entries()) {
      const dow = stylistId === elham.id ? SAT : SUN;
      const time = stylistId === elham.id ? "17:00" : stylistId === sara.id ? "13:00" : "10:30";
      const startsAt = nextLocal(dow, time, -14 + i);
      const start = new Date(startsAt);
      const bookedAt = new Date(start.getTime() - 3 * 86_400_000);
      const b = await createBooking(db, customer, { stylistId, serviceId, startsAt }, { now: bookedAt });
      await confirmBooking(db, stylistActor, { bookingId: b.id }, { now: new Date(bookedAt.getTime() + 3_600_000) });
      await completeBooking(db, stylistActor, { bookingId: b.id }, { now: new Date(start.getTime() + 3 * 3_600_000) });
      await createReview(db, customer, { bookingId: b.id, rating, comment });
    }

    console.log("• favorites");
    await db.insert(favorites).values([
      { customerId: mina.userId, salonId: roseGold.id },
      { customerId: mina.userId, stylistId: negar.id },
      { customerId: leila.userId, stylistId: sara.id },
      { customerId: nazanin.userId, stylistId: elham.id },
      { customerId: parisa.userId, salonId: artemis.id },
    ]);

    const counts = await db.execute<{ table: string; n: number }>(sql`
      select 'users' as table, count(*)::int as n from users union all
      select 'salons', count(*)::int from salons union all
      select 'salon_members', count(*)::int from salon_members union all
      select 'stylists', count(*)::int from stylists union all
      select 'services', count(*)::int from services union all
      select 'working_hours', count(*)::int from working_hours union all
      select 'bookings', count(*)::int from bookings union all
      select 'reviews', count(*)::int from reviews union all
      select 'notifications', count(*)::int from notifications`);
    console.table(counts.rows);
    console.log("✓ seed complete — sign in with any seeded mobile number and the dev OTP (AUTH_STATIC_OTP, default 1111)");
  } finally {
    await db.$client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
