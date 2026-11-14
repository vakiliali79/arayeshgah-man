import { and, eq, inArray, or } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { salonMembers, salons, stylists } from "@/db/schema";
import type { Actor } from "../auth/actor";

/** سالن‌هایی که کاربر می‌تواند در داشبورد سالن مدیریت کند (مالک یا عضو فعال مدیر/پذیرش) */
export async function getManagedSalons(db: DbOrTx, actor: Actor) {
  return db
    .selectDistinct({ id: salons.id, name: salons.name, slug: salons.slug, isActive: salons.isActive, isVerified: salons.isVerified, rejectionReason: salons.rejectionReason })
    .from(salons)
    .leftJoin(salonMembers, eq(salonMembers.salonId, salons.id))
    .where(
      or(
        eq(salons.ownerId, actor.userId),
        and(eq(salonMembers.userId, actor.userId), eq(salonMembers.status, "active"), inArray(salonMembers.role, ["owner", "manager", "receptionist"])),
      ),
    )
    .orderBy(salons.name);
}

export async function getStylistProfile(db: DbOrTx, userId: string) {
  const [row] = await db.select().from(stylists).where(eq(stylists.userId, userId)).limit(1);
  return row ?? null;
}

export type DashboardSection = "customer" | "stylist" | "salon" | "admin";

/** بخش‌های داشبورد قابل دسترس برای این کاربر (تصمیم نهایی همیشه سمت سرور) */
export async function getDashboardSections(db: DbOrTx, actor: Actor): Promise<DashboardSection[]> {
  const sections: DashboardSection[] = [];
  if (actor.role === "admin") sections.push("admin");
  if (actor.role === "salon_owner" || (await getManagedSalons(db, actor)).length > 0) sections.push("salon");
  if (actor.role === "stylist") sections.push("stylist");
  sections.push("customer");
  return sections;
}

export function defaultSectionPath(sections: DashboardSection[]) {
  return `/dashboard/${sections[0]}`;
}
