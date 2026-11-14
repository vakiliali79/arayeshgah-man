import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "@/db/client";
import { favorites, salons, stylists } from "@/db/schema";
import type { Actor } from "../auth/actor";
import { NotFoundError } from "../errors";
import { parseInput } from "../validation";

const targetSchema = z
  .object({ salonId: z.uuid().optional(), stylistId: z.uuid().optional() })
  .strict()
  .refine((v) => Boolean(v.salonId) !== Boolean(v.stylistId), "Exactly one of salonId or stylistId");

/** افزودن/حذف علاقه‌مندی (toggle) — فقط برای خود کاربر؛ مقصد باید فعال باشد */
export async function toggleFavorite(db: DbOrTx, actor: Actor, input: unknown): Promise<{ favorited: boolean }> {
  const t = parseInput(targetSchema, input);
  const where = t.salonId
    ? and(eq(favorites.customerId, actor.userId), eq(favorites.salonId, t.salonId))
    : and(eq(favorites.customerId, actor.userId), eq(favorites.stylistId, t.stylistId!));
  const removed = await db.delete(favorites).where(where).returning({ id: favorites.id });
  if (removed.length > 0) return { favorited: false };

  if (t.salonId) {
    const [s] = await db.select({ id: salons.id }).from(salons).where(and(eq(salons.id, t.salonId), eq(salons.isActive, true))).limit(1);
    if (!s) throw new NotFoundError("Salon");
  } else {
    const [s] = await db.select({ id: stylists.id }).from(stylists).where(and(eq(stylists.id, t.stylistId!), eq(stylists.isActive, true))).limit(1);
    if (!s) throw new NotFoundError("Stylist");
  }
  await db.insert(favorites).values({ customerId: actor.userId, salonId: t.salonId ?? null, stylistId: t.stylistId ?? null }).onConflictDoNothing();
  return { favorited: true };
}

export async function isFavorite(db: DbOrTx, userId: string, target: { salonId?: string; stylistId?: string }) {
  const where = target.salonId
    ? and(eq(favorites.customerId, userId), eq(favorites.salonId, target.salonId))
    : and(eq(favorites.customerId, userId), eq(favorites.stylistId, target.stylistId!));
  const rows = await db.select({ id: favorites.id }).from(favorites).where(where).limit(1);
  return rows.length > 0;
}
