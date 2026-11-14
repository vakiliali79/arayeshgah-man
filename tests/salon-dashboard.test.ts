import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { files, salons, users } from "@/db/schema";
import { cancelBooking, completeBooking, confirmBooking, createBooking } from "@/server/bookings/service";
import { createService } from "@/server/catalog/service";
import { getDashboardSections, getManagedSalons } from "@/server/dashboard/access";
import { AppError, ForbiddenError } from "@/server/errors";
import { getSalonReport, listSalonBookingsByTab, listSalonServices, listSalonTeam } from "@/server/salons/dashboard";
import { acceptSalonInvitation, createSalon, inviteSalonMember, inviteSalonMemberByPhone, requestSalonMembership, setSalonCover } from "@/server/salons/service";
import { createStylistProfile } from "@/server/stylists/service";
import { NOW, SUNDAY, at, clock, closeTestDb, getTestDb, makeSalonScenario, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();
afterAll(closeTestDb);
const after = (iso: string, minutes: number) => ({ now: new Date(new Date(iso).getTime() + minutes * 60_000) });

describe("salon owner dashboard", () => {
  beforeEach(() => resetDb(db));

  it("creates a salon with district and coordinates; customers cannot create salons", async () => {
    const owner = await makeUser(db, "salon_owner");
    const salon = await createSalon(db, owner, { name: "سالن مهتاب", slug: "mahtab", city: "تهران", district: "ونک", address: "خیابان ونک، پلاک ۱", latitude: 35.757, longitude: 51.41 });
    expect(salon).toMatchObject({ district: "ونک", latitude: "35.757000", longitude: "51.410000", isVerified: false, isActive: true });
    await expect(createSalon(db, await makeUser(db), { name: "x y", slug: "xy", city: "تهران", address: "آدرس کامل" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("invites members by phone; unknown numbers are reported", async () => {
    const s = await makeSalonScenario(db);
    await expect(inviteSalonMemberByPhone(db, s.owner, { salonId: s.salon.id, phone: "09350000000", role: "receptionist" })).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
    const rec = await makeUser(db);
    await db.update(users).set({ phoneNumber: "+989351112233" }).where(eq(users.id, rec.userId));
    const inv = await inviteSalonMemberByPhone(db, s.owner, { salonId: s.salon.id, phone: "۰۹۳۵ ۱۱۱ ۲۲۳۳", role: "receptionist" });
    expect(inv).toMatchObject({ status: "invited", role: "receptionist", userId: rec.userId });
    await expect(inviteSalonMemberByPhone(db, rec, { salonId: s.salon.id, phone: "09351112233", role: "manager" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("cover image must be a salon_cover file uploaded by the same user with manage_salon", async () => {
    const s = await makeSalonScenario(db);
    const mk = async (ownerId: string, purpose: "salon_cover" | "avatar") =>
      (await db.insert(files).values({ ownerId, purpose, storageKey: `aa/bb/${Math.random().toString(16).slice(2)}.png`, mimeType: "image/png", sizeBytes: 1, sha256: "a".repeat(64) }).returning())[0]!;
    const own = await mk(s.owner.userId, "salon_cover");
    await setSalonCover(db, s.owner, s.salon.id, own.id);
    expect((await db.select().from(salons).where(eq(salons.id, s.salon.id)))[0]!.coverFileId).toBe(own.id);
    await expect(setSalonCover(db, s.owner, s.salon.id, (await mk(s.owner.userId, "avatar")).id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setSalonCover(db, s.stylistUser, s.salon.id, (await mk(s.stylistUser.userId, "salon_cover")).id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("reports and booking lists only cover this salon; revenue counts completed bookings only", async () => {
    const s = await makeSalonScenario(db);
    const other = await makeSalonScenario(db);
    const [c1, c2, c3] = [await makeUser(db), await makeUser(db), await makeUser(db)];
    const done = await createBooking(db, c1, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "10:00") }, clock);
    const cancelled = await createBooking(db, c2, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "12:00") }, clock);
    await createBooking(db, c3, { stylistId: s.stylist.id, serviceId: s.service.id, startsAt: at(SUNDAY, "14:00") }, clock);
    await createBooking(db, c1, { stylistId: other.stylist.id, serviceId: other.service.id, startsAt: at(SUNDAY, "16:00") }, clock);
    await confirmBooking(db, s.owner, { bookingId: done.id }, clock);
    await completeBooking(db, s.owner, { bookingId: done.id }, after(at(SUNDAY, "10:00"), 70));
    await cancelBooking(db, s.owner, { bookingId: cancelled.id }, clock);

    const r = await getSalonReport(db, s.salon.id, NOW);
    expect(r.status).toEqual({ completed: 1, cancelled: 1, pending: 1 });
    expect([r.completed, r.revenue]).toEqual([1, 1_200_000]);
    expect(r.byStylist).toEqual([{ name: "آرایشگر تست", n: 3, revenue: 1_200_000 }]);
    expect(r.monthly.reduce((a, m) => a + m.bookings, 0)).toBe(3);

    expect((await listSalonBookingsByTab(db, s.salon.id, "pending", NOW)).length).toBe(1);
    expect((await listSalonBookingsByTab(db, s.salon.id, "cancelled", NOW)).map((b) => b.id)).toEqual([cancelled.id]);
  });

  it("lists services with their stylists, and team with join requests", async () => {
    const s = await makeSalonScenario(db);
    const svc = (await listSalonServices(db, s.salon.id))[0]!;
    expect(svc.stylists).toEqual([expect.objectContaining({ stylistId: s.stylist.id, customPrice: 1_200_000 })]);
    const u = await makeUser(db, "stylist");
    await createStylistProfile(db, u, { displayName: "متقاضی همکاری" });
    await requestSalonMembership(db, u, { salonSlug: s.salon.slug });
    const team = await listSalonTeam(db, s.salon.id);
    expect(team.map((m) => m.status).sort()).toEqual(["active", "active", "requested"]);
  });

  it("dashboard access: owners and managers see the salon section; plain stylist members do not", async () => {
    const s = await makeSalonScenario(db);
    expect(await getDashboardSections(db, s.owner)).toEqual(["salon", "customer"]);
    expect(await getDashboardSections(db, s.stylistUser)).toEqual(["stylist", "customer"]);
    const mgr = await makeUser(db);
    const inv = await inviteSalonMember(db, s.owner, { salonId: s.salon.id, userId: mgr.userId, role: "manager" });
    expect(await getManagedSalons(db, mgr)).toHaveLength(0); // هنوز نپذیرفته
    await acceptSalonInvitation(db, mgr, inv.id);
    expect((await getManagedSalons(db, mgr)).map((x) => x.id)).toEqual([s.salon.id]);
    // ادمین سالن‌ها را از داشبورد مدیریت کل اداره می‌کند
    expect(await getDashboardSections(db, await makeUser(db, "admin"))).toEqual(["admin", "customer"]);
  });

  it("a manager without manage_services cannot add services", async () => {
    const s = await makeSalonScenario(db);
    const rec = await makeUser(db);
    const inv = await inviteSalonMember(db, s.owner, { salonId: s.salon.id, userId: rec.userId, role: "receptionist" });
    await acceptSalonInvitation(db, rec, inv.id);
    await expect(createService(db, rec, { salonId: s.salon.id, name: "ناخن", category: "nail", durationMinutes: 30, priceToman: 1 })).rejects.toBeInstanceOf(AppError);
  });
});
