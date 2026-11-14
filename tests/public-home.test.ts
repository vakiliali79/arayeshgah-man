import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { files, profiles, salons, stylists } from "@/db/schema";
import { createService } from "@/server/catalog/service";
import { getHomeData } from "@/server/public/home";
import { createStylistProfile } from "@/server/stylists/service";
import { closeTestDb, getTestDb, makeSalonScenario, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();
afterAll(closeTestDb);

describe("home page data (real data only)", () => {
  beforeEach(() => resetDb(db));

  it("is empty when nothing is public — no fake numbers", async () => {
    await makeSalonScenario(db); // سالن تأییدنشده
    const d = await getHomeData(db);
    expect(d).toMatchObject({ salonCount: 0, stylistCount: 0, avgRating: null, featuredSalons: [], topStylists: [] });
    expect(d.categories.every((c) => c.salons === 0)).toBe(true);
  });

  it("only shows approved salons; each salon gets its own categories (regression: unqualified subquery columns)", async () => {
    const a = await makeSalonScenario(db); // خدمت رنگ (color)
    const b = await makeSalonScenario(db);
    await createService(db, b.owner, { salonId: b.salon.id, name: "ناخن", category: "nail", durationMinutes: 30, priceToman: 1000 });
    await db.update(salons).set({ isVerified: true });
    const d = await getHomeData(db);
    expect(d.salonCount).toBe(2);
    const cats = Object.fromEntries(d.featuredSalons.map((s) => [s.id, [...s.categories].sort()]));
    expect(cats[a.salon.id]).toEqual(["رنگ و لایت"]);
    expect(cats[b.salon.id]).toEqual(["رنگ و لایت", "کاشت و طراحی ناخن"].sort());
    expect(d.categories.find((c) => c.key === "nail")?.salons).toBe(1);
    expect(d.categories.find((c) => c.key === "color")?.salons).toBe(2);
  });

  it("stylists are public when active and independent or in an approved salon; avatar comes from their own profile", async () => {
    const s = await makeSalonScenario(db);
    expect((await getHomeData(db)).stylistCount).toBe(0); // سالن تأییدنشده و آرایشگر غیرمستقل
    const indep = await makeUser(db, "stylist");
    const st = await createStylistProfile(db, indep, { displayName: "مستقل", acceptsIndependentBookings: true });
    const [f] = await db.insert(files).values({ ownerId: indep.userId, purpose: "avatar", storageKey: "aa/bb/a.png", mimeType: "image/png", sizeBytes: 1, sha256: "a".repeat(64) }).returning();
    await db.update(profiles).set({ avatarFileId: f!.id }).where(eq(profiles.userId, indep.userId));
    let d = await getHomeData(db);
    expect(d.topStylists.map((x) => [x.id, x.avatarFileId])).toEqual([[st.id, f!.id]]);
    await db.update(salons).set({ isVerified: true }).where(eq(salons.id, s.salon.id));
    d = await getHomeData(db);
    expect(d.stylistCount).toBe(2);
    expect(d.topStylists.find((x) => x.id === s.stylist.id)?.avatarFileId).toBeNull();
    await db.update(stylists).set({ isActive: false }).where(eq(stylists.id, st.id));
    expect((await getHomeData(db)).stylistCount).toBe(1);
  });
});
