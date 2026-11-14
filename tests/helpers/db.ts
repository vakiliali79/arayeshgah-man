import { sql } from "drizzle-orm";
import { createDb, type Database } from "@/db/client";
import { profiles, users } from "@/db/schema";
import type { UserRole } from "@/db/types";
import type { Actor } from "@/server/auth/actor";
import { createService, assignServiceToStylist } from "@/server/catalog/service";
import { ensureProfile } from "@/server/profiles/service";
import { acceptSalonInvitation, createSalon, inviteSalonMember } from "@/server/salons/service";
import { addWorkingHours } from "@/server/schedules/service";
import { createStylistProfile } from "@/server/stylists/service";
import { getTestDatabaseUrl } from "./env";

let testDb: Database | undefined;

export function getTestDb(): Database {
  testDb ??= createDb(getTestDatabaseUrl(), { max: 20 });
  return testDb;
}

export async function closeTestDb() {
  if (testDb) await testDb.$client.end();
  testDb = undefined;
}

export async function resetDb(db: Database = getTestDb()) {
  await db.execute(sql`
    TRUNCATE users, sessions, accounts, verifications, profiles, files, salons, salon_members, stylists,
             services, stylist_services, working_hours, working_time_off, bookings, booking_events,
             reviews, portfolio_items, favorites, notifications
    RESTART IDENTITY CASCADE`);
}

let seq = 0;

/** کاربر + پروفایل. نقش مستقیم در دیتابیس ست می‌شود (معادل ادمین/seed) */
export async function makeUser(db: Database, role: UserRole = "customer", name = "کاربر تست"): Promise<Actor> {
  seq += 1;
  const [u] = await db
    .insert(users)
    .values({ name, email: `user${seq}-${Date.now()}@test.local`, emailVerified: true })
    .returning();
  await ensureProfile(db, { userId: u!.id, fullName: name });
  if (role !== "customer") await db.update(profiles).set({ role }).where(sql`${profiles.userId} = ${u!.id}`);
  return { userId: u!.id, role };
}

// ------------------------------------------------------------ زمان‌های مرجع
// ۲۱ نوامبر ۲۰۲۶ = شنبه (DOW 6). تهران UTC+03:30 بدون ساعت تابستانی.
export const NOW = new Date("2026-11-21T05:00:00Z"); // شنبه ۰۸:۳۰ تهران
export const SUNDAY = "2026-11-22"; // DOW 0
export const FRIDAY = "2026-11-27"; // DOW 5 — سالن تعطیل
export const at = (date: string, time: string) => `${date}T${time}:00+03:30`;
export const clock = { now: NOW };

/**
 * سناریوی استاندارد: سالن با ساعات ۱۰–۲۰ (شنبه تا پنجشنبه)، آرایشگر عضو سالن با شیفت ۱۰–۱۸،
 * خدمت ۶۰ دقیقه + ۱۵ دقیقه آماده‌سازی، قیمت پایه ۱٬۰۰۰٬۰۰۰ و قیمت اختصاصی آرایشگر ۱٬۲۰۰٬۰۰۰.
 */
export async function makeSalonScenario(db: Database) {
  const owner = await makeUser(db, "salon_owner", "مالک سالن");
  const stylistUser = await makeUser(db, "stylist", "آرایشگر تست");
  const stylist = await createStylistProfile(db, stylistUser, { displayName: "آرایشگر تست" });
  const salon = await createSalon(db, owner, {
    name: "سالن تست",
    slug: `salon-${++seq}`,
    city: "تهران",
    address: "خیابان تست، پلاک ۱",
  });
  const invite = await inviteSalonMember(db, owner, { salonId: salon.id, userId: stylistUser.userId, role: "stylist" });
  await acceptSalonInvitation(db, stylistUser, invite.id);

  for (const dow of [6, 0, 1, 2, 3, 4]) {
    await addWorkingHours(db, owner, { salonId: salon.id, dayOfWeek: dow, opensAt: "10:00", closesAt: "20:00" });
    await addWorkingHours(db, owner, { salonId: salon.id, stylistId: stylist.id, dayOfWeek: dow, opensAt: "10:00", closesAt: "18:00" });
  }
  const service = await createService(db, owner, {
    salonId: salon.id,
    name: "رنگ مو",
    category: "color",
    durationMinutes: 60,
    bufferMinutes: 15,
    priceToman: 1_000_000,
  });
  await assignServiceToStylist(db, owner, { stylistId: stylist.id, serviceId: service.id, customPriceToman: 1_200_000 });

  return { owner, stylistUser, stylist, salon, service };
}
