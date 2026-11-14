import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { salonMembers, salonPermission, salons, stylists } from "@/db/schema";
import type { SalonPermission, UserRole } from "@/db/types";
import { ForbiddenError, NotFoundError } from "../errors";
import { isAdmin, type Actor } from "./actor";

export const ALL_SALON_PERMISSIONS = salonPermission.enumValues;

export function assertRole(actor: Actor, ...roles: UserRole[]) {
  if (!roles.includes(actor.role)) throw new ForbiddenError();
}

export interface SalonAccess {
  salonId: string;
  isAdmin: boolean;
  isOwner: boolean;
  /** مجوزهای مؤثر (owner و admin همه مجوزها را دارند) */
  permissions: ReadonlySet<SalonPermission>;
}

/** محاسبه دسترسی مؤثر کاربر به یک سالن (فقط از روی دیتابیس) */
export async function getSalonAccess(db: DbOrTx, actor: Actor, salonId: string): Promise<SalonAccess> {
  const [salon] = await db.select({ ownerId: salons.ownerId }).from(salons).where(eq(salons.id, salonId)).limit(1);
  if (!salon) throw new NotFoundError("Salon");

  const admin = isAdmin(actor);
  const isOwner = salon.ownerId === actor.userId;
  if (admin || isOwner) {
    return { salonId, isAdmin: admin, isOwner, permissions: new Set(ALL_SALON_PERMISSIONS) };
  }

  const [member] = await db
    .select({ permissions: salonMembers.permissions })
    .from(salonMembers)
    .where(
      and(eq(salonMembers.salonId, salonId), eq(salonMembers.userId, actor.userId), eq(salonMembers.status, "active")),
    )
    .limit(1);

  return { salonId, isAdmin: false, isOwner: false, permissions: new Set(member?.permissions ?? []) };
}

export async function hasSalonPermission(db: DbOrTx, actor: Actor, salonId: string, permission: SalonPermission) {
  const access = await getSalonAccess(db, actor, salonId);
  return access.permissions.has(permission);
}

export async function assertSalonPermission(
  db: DbOrTx,
  actor: Actor,
  salonId: string,
  permission: SalonPermission,
): Promise<SalonAccess> {
  const access = await getSalonAccess(db, actor, salonId);
  if (!access.permissions.has(permission)) throw new ForbiddenError();
  return access;
}

/** پروفایل آرایشگر متعلق به کاربر (یا null) */
export async function getStylistByUserId(db: DbOrTx, userId: string) {
  const [row] = await db.select().from(stylists).where(eq(stylists.userId, userId)).limit(1);
  return row ?? null;
}

/** آیا آرایشگر عضو فعال (با نقش آرایشگر) این سالن است؟ */
export async function isActiveSalonStylist(db: DbOrTx, salonId: string, stylistUserId: string) {
  const [row] = await db
    .select({ id: salonMembers.id })
    .from(salonMembers)
    .where(
      and(
        eq(salonMembers.salonId, salonId),
        eq(salonMembers.userId, stylistUserId),
        eq(salonMembers.status, "active"),
        eq(salonMembers.role, "stylist"),
      ),
    )
    .limit(1);
  return Boolean(row);
}
