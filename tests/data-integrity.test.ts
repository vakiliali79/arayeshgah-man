import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getBookingDetailAdmin, getSalonDetailAdmin, listAllBookings, listSalonsAdmin, reviewSalon } from "@/server/admin/service";
import { createBooking, getBookingWithHistory, listSalonBookings } from "@/server/bookings/service";
import { assignServiceToStylist, createService } from "@/server/catalog/service";
import { getCustomerBooking, listCustomerBookings } from "@/server/customer/queries";
import { getManagedSalons } from "@/server/dashboard/access";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { getPublicSalon, getPublicStylist } from "@/server/public/details";
import { parseSearchParams, searchSalons, searchStylists } from "@/server/public/search";
import { listSalonBookingsByTab, listSalonTeam } from "@/server/salons/dashboard";
import { acceptSalonInvitation, createSalon, inviteSalonMember } from "@/server/salons/service";
import { addWorkingHours } from "@/server/schedules/service";
import { listMyMemberships, listStylistBookingsByTab } from "@/server/stylists/dashboard";
import { createStylistProfile } from "@/server/stylists/service";
import { NOW, SUNDAY, at, clock, closeTestDb, getTestDb, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();
afterAll(closeTestDb);

/**
 * یک رکورد، همه نقش‌ها: سالن، عضویت آرایشگر و نوبت از همان ردیف‌های دیتابیس در داشبورد سالن‌دار،
 * آرایشگر، مشتری، مدیر کل و صفحات عمومی دیده می‌شوند — و نه توسط کاربران نامرتبط.
 */
describe("data integrity across roles", () => {
  beforeEach(() => resetDb(db));

  it("salon registration → owner dashboard → admin review → public search and detail page", async () => {
    const admin = await makeUser(db, "admin");
    const owner = await makeUser(db, "salon_owner", "مالک");
    const salon = await createSalon(db, owner, { name: "سالن یکپارچه", slug: "integrity-salon", city: "شیراز", address: "خیابان زند، پلاک ۵", district: "زند" });

    expect((await getManagedSalons(db, owner)).map((s) => s.id)).toEqual([salon.id]);
    expect((await listSalonsAdmin(db, admin, { status: "pending" })).map((s) => s.id)).toEqual([salon.id]);
    expect((await searchSalons(db, parseSearchParams({ city: "شیراز" }))).total).toBe(0); // تا تأیید، عمومی نیست
    expect(await getPublicSalon(db, "integrity-salon", NOW)).toBeNull();

    await reviewSalon(db, admin, { salonId: salon.id, decision: "approve" });
    const found = await searchSalons(db, parseSearchParams({ city: "شیراز" }));
    expect(found.rows.map((r) => r.id)).toEqual([salon.id]);
    const page = (await getPublicSalon(db, "integrity-salon", NOW))!;
    expect(page.salon).toMatchObject({ id: salon.id, name: "سالن یکپارچه", address: "خیابان زند، پلاک ۵", district: "زند" });
    expect((await getSalonDetailAdmin(db, admin, salon.id)).salon.name).toBe("سالن یکپارچه");
  });

  it("stylist joins a salon → stylist dashboard, owner dashboard, public salon page and public stylist page", async () => {
    const admin = await makeUser(db, "admin");
    const owner = await makeUser(db, "salon_owner");
    const salon = await createSalon(db, owner, { name: "سالن تیم", slug: "team-salon", city: "تهران", address: "خیابان ولیعصر ۱۰" });
    await reviewSalon(db, admin, { salonId: salon.id, decision: "approve" });
    const su = await makeUser(db, "stylist", "نگار");
    const stylist = await createStylistProfile(db, su, { displayName: "نگار" });

    const invite = await inviteSalonMember(db, owner, { salonId: salon.id, userId: su.userId, role: "stylist" });
    expect((await getPublicSalon(db, "team-salon", NOW))!.team).toEqual([]); // دعوت قبول‌نشده، عمومی نیست
    await acceptSalonInvitation(db, su, invite.id);

    expect((await listMyMemberships(db, su.userId)).map((m) => [m.salonId, m.status])).toEqual([[salon.id, "active"]]);
    expect((await listSalonTeam(db, salon.id)).find((m) => m.userId === su.userId)).toMatchObject({ status: "active", role: "stylist", stylistSlug: stylist.slug });
    expect((await getPublicSalon(db, "team-salon", NOW))!.team.map((t) => t.id)).toEqual([stylist.id]);
    expect((await getPublicStylist(db, stylist.slug, NOW))!.salons.map((s) => s.id)).toEqual([salon.id]);
    expect((await searchStylists(db, parseSearchParams({}))).rows.find((r) => r.id === stylist.id)?.salonNames).toEqual(["سالن تیم"]);
  });

  it("a customer's booking appears for the customer, the stylist, the salon and the admin — and nobody else", async () => {
    const admin = await makeUser(db, "admin");
    const owner = await makeUser(db, "salon_owner");
    const salon = await createSalon(db, owner, { name: "سالن نوبت", slug: "booking-salon", city: "تهران", address: "خیابان آزادی ۲۰" });
    await reviewSalon(db, admin, { salonId: salon.id, decision: "approve" });
    const su = await makeUser(db, "stylist");
    const stylist = await createStylistProfile(db, su, { displayName: "سارا" });
    const inv = await inviteSalonMember(db, owner, { salonId: salon.id, userId: su.userId, role: "stylist" });
    await acceptSalonInvitation(db, su, inv.id);
    await addWorkingHours(db, owner, { salonId: salon.id, dayOfWeek: 0, opensAt: "09:00", closesAt: "18:00" });
    await addWorkingHours(db, owner, { salonId: salon.id, stylistId: stylist.id, dayOfWeek: 0, opensAt: "09:00", closesAt: "18:00" });
    const service = await createService(db, owner, { salonId: salon.id, name: "کوتاهی مو", category: "hair", durationMinutes: 45, priceToman: 400_000 });
    await assignServiceToStylist(db, owner, { stylistId: stylist.id, serviceId: service.id });

    const customer = await makeUser(db, "customer", "مینا");
    const b = await createBooking(db, customer, { stylistId: stylist.id, serviceId: service.id, startsAt: at(SUNDAY, "11:00") }, clock);

    expect((await listCustomerBookings(db, customer, "upcoming", NOW)).map((x) => x.id)).toEqual([b.id]);
    expect((await getCustomerBooking(db, customer, b.id)).booking.trackingCode).toBe(b.trackingCode);
    expect((await listStylistBookingsByTab(db, stylist.id, "pending", NOW)).map((x) => x.id)).toEqual([b.id]);
    expect((await listSalonBookingsByTab(db, salon.id, "pending", NOW)).map((x) => x.id)).toEqual([b.id]);
    expect((await listSalonBookings(db, owner, salon.id)).map((x) => x.id)).toEqual([b.id]);
    expect((await listAllBookings(db, admin, { q: b.trackingCode })).rows[0]).toMatchObject({ id: b.id, customerName: "مینا", salonName: "سالن نوبت", stylistName: "سارا", priceToman: 400_000 });
    expect((await getBookingDetailAdmin(db, admin, b.id)).events.map((e) => e.toStatus)).toEqual(["pending"]);

    // جداسازی داده: مشتری دیگر، مالک سالن دیگر و آرایشگر دیگر دسترسی ندارند
    const stranger = await makeUser(db);
    await expect(getCustomerBooking(db, stranger, b.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getBookingWithHistory(db, stranger, b.id)).rejects.toBeInstanceOf(NotFoundError);
    const otherOwner = await makeUser(db, "salon_owner");
    await createSalon(db, otherOwner, { name: "سالن دیگر", slug: "other-salon", city: "تهران", address: "خیابان دیگر ۱" });
    await expect(listSalonBookings(db, otherOwner, salon.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await listCustomerBookings(db, stranger, "upcoming", NOW)).toEqual([]);
    await expect(listAllBookings(db, owner, {})).rejects.toBeInstanceOf(ForbiddenError);
  });
});
