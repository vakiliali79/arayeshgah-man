import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { salons, workingHours } from "@/db/schema";
import { assignServiceToStylist, createService } from "@/server/catalog/service";
import { parseSearchParams, searchSalons, searchStylists } from "@/server/public/search";
import { addTimeOff, addWorkingHours } from "@/server/schedules/service";
import { updateSalon } from "@/server/salons/service";
import { createStylistProfile } from "@/server/stylists/service";
import { closeTestDb, getTestDb, makeSalonScenario, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();
afterAll(closeTestDb);
const P = (raw: Record<string, string> = {}) => parseSearchParams(raw);

/** سالن تأییدشده با شیفت همه روزهای هفته (برای فیلتر نوبت آزاد مستقل از روز اجرای تست) */
async function publicSalon(opts: { city?: string; district?: string; name?: string } = {}) {
  const s = await makeSalonScenario(db);
  await db.update(salons).set({ isVerified: true, city: opts.city ?? "تهران", district: opts.district ?? null, ...(opts.name && { name: opts.name }) }).where(eq(salons.id, s.salon.id));
  await addWorkingHours(db, s.owner, { salonId: s.salon.id, dayOfWeek: 5, opensAt: "10:00", closesAt: "20:00" });
  await addWorkingHours(db, s.owner, { salonId: s.salon.id, stylistId: s.stylist.id, dayOfWeek: 5, opensAt: "10:00", closesAt: "18:00" });
  // ساعت‌های دیرهنگام تا همیشه زمان آینده‌ای در روز جاری هم وجود داشته باشد
  return s;
}

describe("search params", () => {
  it("ignores invalid values instead of failing", () => {
    expect(P({ minPrice: "abc", sort: "hack", page: "-3", category: "x", minRating: "9" })).toMatchObject({ minPrice: undefined, sort: "popular", page: 1, category: undefined, minRating: undefined, available: false });
    expect(P({ minPrice: "۵۰۰۰۰۰", available: "1", sort: "rating" })).toMatchObject({ minPrice: 500000, available: true, sort: "rating" });
  });
});

describe("salon search", () => {
  beforeEach(() => resetDb(db));

  it("returns only approved salons and filters by text, city, district, category, price and rating", async () => {
    await makeSalonScenario(db); // تأییدنشده
    const a = await publicSalon({ city: "تهران", district: "ونک", name: "سالن آفتاب" });
    const b = await publicSalon({ city: "کرج", district: "گوهردشت", name: "سالن مهتاب" });
    await createService(db, b.owner, { salonId: b.salon.id, name: "کاشت ناخن", category: "nail", durationMinutes: 60, priceToman: 400_000 });
    await updateSalon(db, a.owner, a.salon.id, { description: "x" });
    await db.update(salons).set({ ratingAvg: 4.8, ratingCount: 10 }).where(eq(salons.id, a.salon.id));

    const ids = async (raw: Record<string, string>) => (await searchSalons(db, P(raw))).rows.map((r) => r.id);
    expect((await searchSalons(db, P())).total).toBe(2);
    expect(await ids({ q: "آفتاب" })).toEqual([a.salon.id]);
    expect(await ids({ q: "ناخن" })).toEqual([b.salon.id]); // نام خدمت
    expect(await ids({ city: "کرج" })).toEqual([b.salon.id]);
    expect(await ids({ district: "ونک" })).toEqual([a.salon.id]);
    expect(await ids({ category: "nail" })).toEqual([b.salon.id]);
    expect(await ids({ maxPrice: "500000" })).toEqual([b.salon.id]);
    expect((await ids({ minPrice: "900000" })).sort()).toEqual([a.salon.id, b.salon.id].sort()); // هر دو خدمت ۱٬۰۰۰٬۰۰۰ تومانی دارند
    expect(await ids({ minPrice: "2000000" })).toEqual([]);
    expect(await ids({ minRating: "4" })).toEqual([a.salon.id]);
    expect(await ids({ sort: "price_asc" })).toEqual([b.salon.id, a.salon.id]);
    expect(await ids({ sort: "rating" })).toEqual([a.salon.id, b.salon.id]);
    const r = (await searchSalons(db, P({ q: "مهتاب" }))).rows[0]!;
    expect(r).toMatchObject({ minPrice: 400_000 });
    expect([...r.categories].sort()).toEqual(["رنگ و لایت", "کاشت و طراحی ناخن"].sort());
  });

  it("paginates", async () => {
    for (let i = 0; i < 13; i++) await publicSalon();
    const p1 = await searchSalons(db, P());
    const p2 = await searchSalons(db, P({ page: "2" }));
    expect([p1.total, p1.rows.length, p2.rows.length]).toEqual([13, 12, 1]);
  });

  it("'available' keeps only salons with a real free window in the next 7 days", async () => {
    const a = await publicSalon();
    const b = await publicSalon();
    // سالن b: بدون هیچ شیفت آرایشگر
    await db.delete(workingHours).where(eq(workingHours.stylistId, b.stylist.id));
    expect((await searchSalons(db, P({ available: "1" }))).rows.map((r) => r.id)).toEqual([a.salon.id]);
    // سالن a: تعطیلی کامل ۸ روز آینده
    await addTimeOff(db, a.owner, { salonId: a.salon.id, startsAt: new Date(Date.now() - 3600_000).toISOString(), endsAt: new Date(Date.now() + 8 * 86_400_000).toISOString() });
    expect((await searchSalons(db, P({ available: "1" }))).total).toBe(0);
  });
});

describe("stylist search", () => {
  beforeEach(() => resetDb(db));

  it("shows independent and salon stylists with their salons; filters work", async () => {
    const s = await publicSalon({ city: "تهران", name: "سالن آفتاب" });
    const u = await makeUser(db, "stylist");
    const indep = await createStylistProfile(db, u, { displayName: "الهام مستقل", acceptsIndependentBookings: true, specialties: ["پاکسازی پوست"], city: "شیراز" });
    const svc = await createService(db, u, { stylistId: indep.id, name: "پاکسازی", category: "skin", durationMinutes: 60, priceToman: 300_000 });
    await assignServiceToStylist(db, u, { stylistId: indep.id, serviceId: svc.id });
    for (let d = 0; d < 7; d++) await addWorkingHours(db, u, { stylistId: indep.id, dayOfWeek: d, opensAt: "00:00", closesAt: "24:00" });
    // آرایشگر عضو سالن تأییدنشده دیده نمی‌شود
    await makeSalonScenario(db);

    const all = await searchStylists(db, P());
    expect(all.total).toBe(2);
    const member = all.rows.find((r) => r.id === s.stylist.id)!;
    expect(member).toMatchObject({ salonNames: ["سالن آفتاب"], independent: false, minPrice: 1_200_000 });
    const ids = async (raw: Record<string, string>) => (await searchStylists(db, P(raw))).rows.map((r) => r.id).sort();
    expect(await ids({ q: "الهام" })).toEqual([indep.id]);
    expect(await ids({ specialty: "پوست" })).toEqual([indep.id]);
    expect(await ids({ city: "تهران" })).toEqual([s.stylist.id]); // شهر سالن
    expect(await ids({ city: "شیراز" })).toEqual([indep.id]);
    expect(await ids({ category: "skin" })).toEqual([indep.id]);
    expect(await ids({ maxPrice: "500000" })).toEqual([indep.id]);
    expect(await ids({ available: "1" })).toEqual([indep.id, s.stylist.id].sort());
    await db.delete(workingHours).where(eq(workingHours.stylistId, indep.id));
    expect(await ids({ available: "1" })).toEqual([s.stylist.id]);
  });
});
