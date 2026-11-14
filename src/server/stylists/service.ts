import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { DbOrTx } from "@/db/client";
import { stylists } from "@/db/schema";
import type { Actor } from "../auth/actor";
import { assertRole } from "../auth/permissions";
import { ConflictError, PG, findPgError } from "../errors";
import { isValidTimeZone } from "../time";
import { parseInput } from "../validation";

export const stylistSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug may contain a-z, 0-9 and dashes")
  .min(3)
  .max(60);

/** شناسه آدرس تصادفی برای آرایشگری که slug انتخاب نکرده است */
export const randomStylistSlug = () => `stylist-${randomUUID().replace(/-/g, "").slice(0, 10)}`;

const createStylistSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  slug: stylistSlugSchema.optional(),
  city: z.string().trim().min(2).max(60).optional(),
  district: z.string().trim().min(2).max(60).optional(),
  bio: z.string().trim().max(1000).optional(),
  specialties: z.array(z.string().trim().min(2).max(40)).max(10).default([]),
  yearsExperience: z.number().int().min(0).max(70).optional(),
  acceptsIndependentBookings: z.boolean().default(false),
  timezone: z.string().refine(isValidTimeZone, "Invalid IANA time zone").default("Asia/Tehran"),
});

/** ساخت پروفایل آرایشگر برای کاربر جاری (نقش باید stylist باشد) */
export async function createStylistProfile(db: DbOrTx, actor: Actor, input: unknown) {
  assertRole(actor, "stylist");
  const data = parseInput(createStylistSchema, input);
  try {
    const [row] = await db.insert(stylists).values({ ...data, slug: data.slug ?? randomStylistSlug(), userId: actor.userId }).returning();
    return row!;
  } catch (err) {
    const pg = findPgError(err);
    if (pg?.code === PG.UNIQUE_VIOLATION && pg.constraint === "stylists_slug_unique") throw new ConflictError("SLUG_TAKEN", "This address is already taken");
    if (pg?.code === PG.UNIQUE_VIOLATION) throw new ConflictError("STYLIST_EXISTS", "Stylist profile already exists");
    throw err;
  }
}
