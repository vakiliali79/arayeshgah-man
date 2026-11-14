import { z } from "zod";
import type { DbOrTx } from "@/db/client";
import { stylists } from "@/db/schema";
import type { Actor } from "../auth/actor";
import { assertRole } from "../auth/permissions";
import { ConflictError, PG, findPgError } from "../errors";
import { isValidTimeZone } from "../time";
import { parseInput } from "../validation";

const createStylistSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
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
    const [row] = await db.insert(stylists).values({ ...data, userId: actor.userId }).returning();
    return row!;
  } catch (err) {
    if (findPgError(err)?.code === PG.UNIQUE_VIOLATION) throw new ConflictError("STYLIST_EXISTS", "Stylist profile already exists");
    throw err;
  }
}
