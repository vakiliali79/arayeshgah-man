import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { profiles } from "@/db/schema";
import type { UserRole } from "@/db/types";
import { UnauthorizedError } from "../errors";

/**
 * کاربری که عملیات را انجام می‌دهد. نقش همیشه از دیتابیس خوانده می‌شود،
 * هرگز از ورودی کلاینت یا کوکی.
 */
export interface Actor {
  userId: string;
  role: UserRole;
}

export async function loadActor(db: DbOrTx, userId: string | null | undefined): Promise<Actor> {
  if (!userId) throw new UnauthorizedError();
  const [row] = await db
    .select({ userId: profiles.userId, role: profiles.role })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!row) throw new UnauthorizedError("Profile not found for authenticated user");
  return row;
}

export const isAdmin = (actor: Actor) => actor.role === "admin";
