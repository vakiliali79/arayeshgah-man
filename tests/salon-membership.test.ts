import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { salonMembers } from "@/db/schema";
import { getSalonAccess } from "@/server/auth/permissions";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import {
  acceptSalonInvitation,
  createSalon,
  inviteSalonMember,
  removeSalonMember,
  updateMemberPermissions,
  updateSalon,
} from "@/server/salons/service";
import { createStylistProfile } from "@/server/stylists/service";
import { closeTestDb, getTestDb, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();
const salonInput = (slug: string) => ({ name: "سالن تست", slug, city: "تهران", address: "خیابان تست، پلاک ۱" });

async function setup() {
  const owner = await makeUser(db, "salon_owner");
  const salon = await createSalon(db, owner, salonInput("salon-a"));
  return { owner, salon };
}

describe("salon membership & permissions", () => {
  beforeEach(() => resetDb(db));
  afterAll(closeTestDb);

  it("creates an active owner membership with all permissions in the same transaction", async () => {
    const { owner, salon } = await setup();
    const [m] = await db.select().from(salonMembers).where(eq(salonMembers.salonId, salon.id));
    expect(m).toMatchObject({ userId: owner.userId, role: "owner", status: "active" });
    expect(m!.permissions).toHaveLength(7);
  });

  it("rejects duplicate salon slugs", async () => {
    const { owner } = await setup();
    await expect(createSalon(db, owner, salonInput("salon-a"))).rejects.toBeInstanceOf(ConflictError);
  });

  it("only stylists (with a stylist profile) can be invited as stylist, and 'owner' cannot be invited", async () => {
    const { owner, salon } = await setup();
    const customer = await makeUser(db);
    await expect(inviteSalonMember(db, owner, { salonId: salon.id, userId: customer.userId, role: "stylist" })).rejects.toBeInstanceOf(BusinessRuleError);
    await expect(inviteSalonMember(db, owner, { salonId: salon.id, userId: customer.userId, role: "owner" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("invitation can be accepted only by the invited user", async () => {
    const { owner, salon } = await setup();
    const stylistUser = await makeUser(db, "stylist");
    await createStylistProfile(db, stylistUser, { displayName: "آرایشگر" });
    const invite = await inviteSalonMember(db, owner, { salonId: salon.id, userId: stylistUser.userId, role: "stylist" });
    const stranger = await makeUser(db, "stylist");
    await expect(acceptSalonInvitation(db, stranger, invite.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(acceptSalonInvitation(db, stylistUser, invite.id)).resolves.toMatchObject({ status: "active" });
  });

  it("a stylist can belong to multiple salons", async () => {
    const { owner, salon } = await setup();
    const owner2 = await makeUser(db, "salon_owner");
    const salon2 = await createSalon(db, owner2, salonInput("salon-b"));
    const stylistUser = await makeUser(db, "stylist");
    await createStylistProfile(db, stylistUser, { displayName: "آرایشگر" });
    for (const [o, s] of [[owner, salon], [owner2, salon2]] as const) {
      const inv = await inviteSalonMember(db, o, { salonId: s.id, userId: stylistUser.userId, role: "stylist" });
      await acceptSalonInvitation(db, stylistUser, inv.id);
    }
    const rows = await db
      .select()
      .from(salonMembers)
      .where(and(eq(salonMembers.userId, stylistUser.userId), eq(salonMembers.status, "active")));
    expect(rows).toHaveLength(2);
  });

  it("non-members and other owners cannot manage a salon", async () => {
    const { salon } = await setup();
    const otherOwner = await makeUser(db, "salon_owner");
    await expect(updateSalon(db, otherOwner, salon.id, { name: "تصاحب" })).rejects.toBeInstanceOf(ForbiddenError);
    const access = await getSalonAccess(db, otherOwner, salon.id);
    expect(access.permissions.size).toBe(0);
  });

  it("admins have full access to any salon", async () => {
    const { salon } = await setup();
    const admin = await makeUser(db, "admin");
    await expect(updateSalon(db, admin, salon.id, { name: "نام اصلاح‌شده" })).resolves.toMatchObject({ name: "نام اصلاح‌شده" });
  });

  it("managers cannot grant permissions they do not hold or edit their own permissions", async () => {
    const { owner, salon } = await setup();
    const managerUser = await makeUser(db, "customer");
    const inv = await inviteSalonMember(db, owner, {
      salonId: salon.id, userId: managerUser.userId, role: "manager", permissions: ["manage_members", "manage_bookings"],
    });
    await acceptSalonInvitation(db, managerUser, inv.id);

    const receptionist = await makeUser(db);
    // مدیر manage_salon ندارد → نمی‌تواند اعطا کند
    await expect(
      inviteSalonMember(db, managerUser, { salonId: salon.id, userId: receptionist.userId, role: "receptionist", permissions: ["manage_salon"] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const rInv = await inviteSalonMember(db, managerUser, {
      salonId: salon.id, userId: receptionist.userId, role: "receptionist", permissions: ["manage_bookings"],
    });
    expect(rInv.permissions).toEqual(["manage_bookings"]);

    await expect(
      updateMemberPermissions(db, managerUser, { membershipId: inv.id, permissions: ["manage_salon"] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("members without manage_members cannot invite", async () => {
    const { owner, salon } = await setup();
    const rec = await makeUser(db);
    const inv = await inviteSalonMember(db, owner, { salonId: salon.id, userId: rec.userId, role: "receptionist" });
    await acceptSalonInvitation(db, rec, inv.id);
    const someone = await makeUser(db);
    await expect(inviteSalonMember(db, rec, { salonId: salon.id, userId: someone.userId, role: "receptionist" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("the owner membership cannot be removed; members can leave", async () => {
    const { owner, salon } = await setup();
    const [ownerRow] = await db.select().from(salonMembers).where(eq(salonMembers.salonId, salon.id));
    await expect(removeSalonMember(db, owner, ownerRow!.id)).rejects.toBeInstanceOf(ForbiddenError);

    const rec = await makeUser(db);
    const inv = await inviteSalonMember(db, owner, { salonId: salon.id, userId: rec.userId, role: "receptionist" });
    await acceptSalonInvitation(db, rec, inv.id);
    await expect(removeSalonMember(db, rec, inv.id)).resolves.toMatchObject({ status: "left" });
    const access = await getSalonAccess(db, rec, salon.id);
    expect(access.permissions.size).toBe(0);
  });
});
