import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Database, DbOrTx } from "@/db/client";
import { files, salonMembers, salonPermission, salons, stylists, users } from "@/db/schema";
import type { SalonPermission } from "@/db/types";
import type { Actor } from "../auth/actor";
import { ALL_SALON_PERMISSIONS, assertRole, assertSalonPermission, getSalonAccess } from "../auth/permissions";
import { AppError, BusinessRuleError, ConflictError, ForbiddenError, NotFoundError, PG, ValidationError, findPgError } from "../errors";
import { normalizeIranMobile } from "../otp/phone";

class NotFoundErrorWithCode extends AppError {
  constructor(code: string) {
    super(code, "Not found", 404);
  }
}
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
  district: z.string().trim().min(2).max(60).optional(),
  latitude: z.number().min(24).max(40).optional(),
  longitude: z.number().min(44).max(64).optional(),
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
      const { latitude, longitude, ...rest } = data;
      const [salon] = await tx
        .insert(salons)
        .values({ ...rest, latitude: latitude?.toString(), longitude: longitude?.toString(), ownerId: actor.userId })
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
  const { latitude, longitude, ...data } = parseInput(updateSalonSchema, input);
  const [row] = await db
    .update(salons)
    .set({
      ...data,
      ...(latitude !== undefined && { latitude: latitude.toString() }),
      ...(longitude !== undefined && { longitude: longitude.toString() }),
      // سالن ردشده با ویرایش اطلاعات توسط مالک، دوباره برای بررسی «در انتظار تأیید» می‌شود
      rejectionReason: null,
    })
    .where(eq(salons.id, salonId))
    .returning();
  return row!;
}

/** آرایشگر درخواست عضویت در یک سالن فعال را ثبت می‌کند (با نشانی صفحه سالن) */
export async function requestSalonMembership(db: Database, actor: Actor, input: unknown) {
  const { salonSlug } = parseInput(z.object({ salonSlug: z.string().trim().toLowerCase().min(2).max(80) }).strict(), input);
  return db.transaction(async (tx) => {
    const [stylist] = await tx.select({ id: stylists.id }).from(stylists).where(eq(stylists.userId, actor.userId)).limit(1);
    if (!stylist) throw new BusinessRuleError("PROFILE_REQUIRED", "Stylist profile required");
    const [salon] = await tx.select().from(salons).where(and(eq(salons.slug, salonSlug), eq(salons.isActive, true))).limit(1);
    if (!salon) throw new NotFoundError("Salon");
    const [existing] = await tx.select().from(salonMembers).where(and(eq(salonMembers.salonId, salon.id), eq(salonMembers.userId, actor.userId))).for("update").limit(1);
    if (existing) {
      if (existing.status === "requested") throw new ConflictError("ALREADY_REQUESTED", "Request already sent");
      if (existing.status !== "left") throw new ConflictError("ALREADY_MEMBER", "Already a member or invited");
      const [row] = await tx
        .update(salonMembers)
        .set({ status: "requested", role: "stylist", permissions: DEFAULT_MEMBER_PERMISSIONS.stylist, invitedBy: null, joinedAt: null })
        .where(eq(salonMembers.id, existing.id))
        .returning();
      return row!;
    }
    const [row] = await tx
      .insert(salonMembers)
      .values({ salonId: salon.id, userId: actor.userId, role: "stylist", status: "requested", permissions: DEFAULT_MEMBER_PERMISSIONS.stylist })
      .returning();
    return row!;
  });
}

/** پاسخ سالن به درخواست عضویت آرایشگر (نیازمند manage_members) */
export async function respondToMembershipRequest(db: Database, actor: Actor, input: { membershipId: string; approve: boolean }) {
  return db.transaction(async (tx) => {
    const [m] = await tx.select().from(salonMembers).where(eq(salonMembers.id, input.membershipId)).for("update").limit(1);
    if (!m || m.status !== "requested") throw new NotFoundError("Membership request");
    await assertSalonPermission(tx, actor, m.salonId, "manage_members");
    const [row] = await tx
      .update(salonMembers)
      .set(input.approve ? { status: "active", joinedAt: new Date(), invitedBy: actor.userId } : { status: "left" })
      .where(eq(salonMembers.id, m.id))
      .returning();
    return row!;
  });
}

/** رد دعوت سالن توسط خود کاربر دعوت‌شده */
export async function declineSalonInvitation(db: DbOrTx, actor: Actor, membershipId: string) {
  const [row] = await db
    .update(salonMembers)
    .set({ status: "left" })
    .where(and(eq(salonMembers.id, membershipId), eq(salonMembers.userId, actor.userId), eq(salonMembers.status, "invited")))
    .returning();
  if (!row) throw new NotFoundError("Invitation");
  return row;
}

/** دعوت عضو با شماره موبایل ورود او */
export async function inviteSalonMemberByPhone(db: Database, actor: Actor, input: { salonId: string; phone: string; role: "manager" | "stylist" | "receptionist"; permissions?: SalonPermission[] }) {
  const phone = normalizeIranMobile(input.phone);
  if (!phone) throw new ValidationError("Invalid phone", { phone: "invalid" });
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.phoneNumber, phone)).limit(1);
  if (!user) throw new NotFoundErrorWithCode("USER_NOT_FOUND");
  return inviteSalonMember(db, actor, { salonId: input.salonId, userId: user.id, role: input.role, permissions: input.permissions });
}

/** تصویر کاور سالن (فایل باید salon_cover و بارگذاری‌شده توسط همین کاربر باشد) */
export async function setSalonCover(db: Database, actor: Actor, salonId: string, fileId: string) {
  await assertSalonPermission(db, actor, salonId, "manage_salon");
  const [file] = await db.select().from(files).where(and(eq(files.id, fileId), isNull(files.deletedAt))).limit(1);
  if (!file || file.ownerId !== actor.userId || file.purpose !== "salon_cover") throw new ForbiddenError();
  await db.update(salons).set({ coverFileId: fileId }).where(eq(salons.id, salonId));
}

export { getSalonAccess };
