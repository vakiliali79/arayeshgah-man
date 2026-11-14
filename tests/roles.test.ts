import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { profiles, users } from "@/db/schema";
import { loadActor } from "@/server/auth/actor";
import { createAuth } from "@/server/auth/better-auth";
import { MemoryMailer } from "@/server/mail/mailer";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/server/errors";
import { adminSetUserRole, selectInitialRole, updateOwnProfile } from "@/server/profiles/service";
import { createSalon } from "@/server/salons/service";
import { createStylistProfile } from "@/server/stylists/service";
import { closeTestDb, getTestDb, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();

describe("user roles & privilege escalation", () => {
  beforeEach(() => resetDb(db));
  afterAll(closeTestDb);

  it("Better Auth sign-up creates a customer profile even if 'admin' is submitted", async () => {
    const auth = createAuth(db, { mailer: new MemoryMailer() });
    // Better Auth فیلد ناشناخته role را نادیده می‌گیرد؛ نقش فقط از جدول profiles می‌آید
    await auth.api.signUpEmail({
      body: { name: "مهاجم", email: "attacker@test.local", password: "Password123", role: "admin" } as never,
    });
    const [user] = await db.select().from(users).where(eq(users.email, "attacker@test.local"));
    expect(user).toBeDefined();
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user!.id));
    expect(profile?.role).toBe("customer");
    const admins = await db.select().from(profiles).where(eq(profiles.role, "admin"));
    expect(admins).toHaveLength(0);
  });

  it("Better Auth sign-up hook creates exactly one customer profile", async () => {
    const auth = createAuth(db, { mailer: new MemoryMailer() });
    await auth.api.signUpEmail({ body: { name: "مشتری جدید", email: "new@test.local", password: "Password123" } });
    const [user] = await db.select().from(users).where(eq(users.email, "new@test.local"));
    const rows = await db.select().from(profiles).where(eq(profiles.userId, user!.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ role: "customer", fullName: "مشتری جدید" });
  });

  it("loads the actor role from the database, not from input", async () => {
    const u = await makeUser(db, "stylist");
    await expect(loadActor(db, u.userId)).resolves.toEqual({ userId: u.userId, role: "stylist" });
    await expect(loadActor(db, null)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("never allows self-selecting admin as initial role", async () => {
    const u = await makeUser(db);
    await expect(selectInitialRole(db, u, { role: "admin" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("allows selecting an initial role only once", async () => {
    const u = await makeUser(db);
    await expect(selectInitialRole(db, u, { role: "salon_owner" })).resolves.toEqual({ role: "salon_owner" });
    const actor = await loadActor(db, u.userId);
    await expect(selectInitialRole(db, actor, { role: "stylist" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("only admins can change roles, and not their own", async () => {
    const admin = await makeUser(db, "admin");
    const owner = await makeUser(db, "salon_owner");
    const target = await makeUser(db);
    await expect(adminSetUserRole(db, owner, { userId: target.userId, role: "admin" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(adminSetUserRole(db, admin, { userId: target.userId, role: "stylist" })).resolves.toEqual({ role: "stylist" });
    await expect(adminSetUserRole(db, admin, { userId: admin.userId, role: "customer" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("profile updates cannot smuggle a role change", async () => {
    const u = await makeUser(db);
    await expect(updateOwnProfile(db, u, { fullName: "نام جدید", role: "admin" })).rejects.toBeInstanceOf(ValidationError);
    const [p] = await db.select().from(profiles).where(eq(profiles.userId, u.userId));
    expect(p?.role).toBe("customer");
  });

  it("only salon owners/admins can create salons; owner is always the actor", async () => {
    const customer = await makeUser(db);
    const owner = await makeUser(db, "salon_owner");
    const other = await makeUser(db, "salon_owner");
    const input = { name: "سالن", slug: "my-salon", city: "تهران", address: "آدرس کامل سالن" };
    await expect(createSalon(db, customer, input)).rejects.toBeInstanceOf(ForbiddenError);
    const salon = await createSalon(db, owner, { ...input, ownerId: other.userId } as never);
    expect(salon.ownerId).toBe(owner.userId);
  });

  it("only users with the stylist role can create a stylist profile", async () => {
    const customer = await makeUser(db);
    await expect(createStylistProfile(db, customer, { displayName: "آرایشگر" })).rejects.toBeInstanceOf(ForbiddenError);
    const stylist = await makeUser(db, "stylist");
    await expect(createStylistProfile(db, stylist, { displayName: "آرایشگر" })).resolves.toMatchObject({ userId: stylist.userId });
  });
});
