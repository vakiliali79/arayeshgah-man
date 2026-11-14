import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database, DbOrTx } from "@/db/client";
import { salonMembers, salonPermission, salons, stylists } from "@/db/schema";
import type { SalonPermission } from "@/db/types";
import type { Actor } from "../auth/actor";
import { ALL_SALON_PERMISSIONS, assertRole, assertSalonPermission, getSalonAccess } from "../auth/permissions";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError, PG, findPgError } from "../errors";
import { parseInput } from "../validation";
import { isValidTimeZone } from "../time";

const createSalonSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug may contain a-z, 0-9 and dashes")
    .max(80),
  description: z.string().trim().max(2000).optional(),
  phone: z
    .string()
    .regex(/^0\d{10}$/)
    .optional(),
  city: z.string().trim().min(2).max(60),
  address: z.string().trim().min(5).max(300),
  timezone: z.string().refine(isValidTimeZone, "Invalid IANA time zone").default("Asia/Tehran"),
});

/**
 * ایجاد سالن: فقط salon_owner یا admin. مالک همیشه خود کاربر است (از ورودی خوانده نمی‌شود)
 * و در همان تراکنش عضویت owner با همه مجوزها ساخته می‌شود.
 */
export async function createSalon(db: Database, actor: Actor, input: unknown) {
  assertRole(actor, "salon_owner", "admin");
  const data = parseInput(createSalonSchema, input);
  try {
    return await db.transaction(async (tx) => {
      const [salon] = await tx
        .insert(salons)
        .values({ ...data, ownerId: actor.userId })
        .returning();
      await tx.insert(salonMembers).values({
        salonId: salon!.id,
        userId: actor.userId,
        role: "owner",
        status: "active",
        permissions: [...ALL_SALON_PERMISSIONS],
        joinedAt: new Date(),
      });
      return salon!;
    });
  } catch (err) {
    if (findPgError(err)?.code === PG.UNIQUE_VIOLATION) throw new ConflictError("SLUG_TAKEN", "Salon slug is already taken");
    throw err;
  }
}

const permissionsSchema = z.array(z.enum(salonPermission.enumValues)).max(ALL_SALON_PERMISSIONS.length);

/** پیش‌فرض مجوزها برای هر نقش عضو */
export const DEFAULT_MEMBER_PERMISSIONS: Record<"manager" | "stylist" | "receptionist", SalonPermission[]> = {
  manager: ["manage_services", "manage_schedule", "manage_bookings", "manage_portfolio", "view_reports"],
  stylist: ["manage_portfolio"],
  receptionist: ["manage_bookings"],
};

const inviteSchema = z.object({
  salonId: z.uuid(),
  userId: z.uuid(),
  role: z.enum(["manager", "stylist", "receptionist"]), // «owner» قابل دعوت نیست
  permissions: permissionsSchema.optional(),
});

/** هیچ عضوی نمی‌تواند مجوزی بیشتر از مجوزهای خودش اعطا کند (جلوگیری از ارتقای دسترسی) */
function assertCanGrant(granterPermissions: ReadonlySet<SalonPermission>, requested: readonly SalonPermission[]) {
  const excess = requested.filter((p) => !granterPermissions.has(p));
  if (excess.length > 0) throw new ForbiddenError(`Cannot grant permissions you do not hold: ${excess.join(", ")}`);
}

export async function inviteSalonMember(db: Database, actor: Actor, input: unknown) {
  const data = parseInput(inviteSchema, input);
  return db.transaction(async (tx) => {
    const access = await assertSalonPermission(tx, actor, data.salonId, "manage_members");
    const permissions = [...new Set(data.permissions ?? DEFAULT_MEMBER_PERMISSIONS[data.role])];
    assertCanGrant(access.permissions, permissions);

    if (data.role === "stylist") {
      const [stylist] = await tx.select({ id: stylists.id }).from(stylists).where(eq(stylists.userId, data.userId)).limit(1);
      if (!stylist) throw new BusinessRuleError("NOT_A_STYLIST", "Only users with a stylist profile can join as stylist");
    }

    try {
      const [member] = await tx
        .insert(salonMembers)
        .values({ salonId: data.salonId, userId: data.userId, role: data.role, status: "invited", permissions, invitedBy: actor.userId })
        .returning();
      return member!;
    } catch (err) {
      const pg = findPgError(err);
      if (pg?.code === PG.UNIQUE_VIOLATION) throw new ConflictError("ALREADY_MEMBER", "User is already a member of this salon");
      if (pg?.code === PG.FOREIGN_KEY_VIOLATION) throw new NotFoundError("User");
      throw err;
    }
  });
}

/** فقط خود کاربر دعوت‌شده می‌تواند دعوت را بپذیرد */
export async function acceptSalonInvitation(db: DbOrTx, actor: Actor, membershipId: string) {
  const [row] = await db
    .update(salonMembers)
    .set({ status: "active", joinedAt: new Date() })
    .where(and(eq(salonMembers.id, membershipId), eq(salonMembers.userId, actor.userId), eq(salonMembers.status, "invited")))
    .returning();
  if (!row) throw new NotFoundError("Invitation");
  return row;
}

const updatePermissionsSchema = z.object({ membershipId: z.uuid(), permissions: permissionsSchema });

export async function updateMemberPermissions(db: Database, actor: Actor, input: unknown) {
  const data = parseInput(updatePermissionsSchema, input);
  return db.transaction(async (tx) => {
    const [member] = await tx.select().from(salonMembers).where(eq(salonMembers.id, data.membershipId)).for("update").limit(1);
    if (!member) throw new NotFoundError("Membership");
    if (member.role === "owner") throw new ForbiddenError("Owner permissions cannot be changed");
    if (member.userId === actor.userId) throw new ForbiddenError("Members cannot change their own permissions");

    const access = await assertSalonPermission(tx, actor, member.salonId, "manage_members");
    const permissions = [...new Set(data.permissions)];
    assertCanGrant(access.permissions, permissions);
    // برداشتن مجوزی که خود مدیر ندارد هم مجاز نیست (جلوگیری از دست‌کاری اعضای هم‌سطح یا بالاتر)
    assertCanGrant(access.permissions, member.permissions);

    const [updated] = await tx.update(salonMembers).set({ permissions }).where(eq(salonMembers.id, member.id)).returning();
    return updated!;
  });
}

/** حذف عضو (توسط مدیر دارای manage_members) یا ترک سالن توسط خود عضو. owner قابل حذف نیست. */
export async function removeSalonMember(db: Database, actor: Actor, membershipId: string) {
  return db.transaction(async (tx) => {
    const [member] = await tx.select().from(salonMembers).where(eq(salonMembers.id, membershipId)).for("update").limit(1);
    if (!member) throw new NotFoundError("Membership");
    if (member.role === "owner") throw new ForbiddenError("The salon owner cannot be removed");

    if (member.userId !== actor.userId) {
      const access = await assertSalonPermission(tx, actor, member.salonId, "manage_members");
      assertCanGrant(access.permissions, member.permissions);
    }
    const [updated] = await tx.update(salonMembers).set({ status: "left" }).where(eq(salonMembers.id, member.id)).returning();
    return updated!;
  });
}

const updateSalonSchema = createSalonSchema.omit({ slug: true }).partial().strict();

export async function updateSalon(db: DbOrTx, actor: Actor, salonId: string, input: unknown) {
  await assertSalonPermission(db, actor, salonId, "manage_salon");
  const data = parseInput(updateSalonSchema, input);
  const [row] = await db.update(salons).set(data).where(eq(salons.id, salonId)).returning();
  return row!;
}

export { getSalonAccess };
