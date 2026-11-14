import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "@/db/client";
import { reviews, supportTickets } from "@/db/schema";
import { ticketKind, ticketStatus } from "@/db/schema";
import type { Actor } from "../auth/actor";
import { ForbiddenError, NotFoundError } from "../errors";
import { parseInput } from "../validation";

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^09\d{9}$/));

const ticketSchema = z
  .object({
    kind: z.enum(["contact", "support", "complaint"]),
    name: z.string().trim().min(2).max(80),
    phone: phone.optional(),
    email: z.email().max(120).optional(),
    subject: z.string().trim().min(3).max(120),
    message: z.string().trim().min(10).max(4000),
  })
  .strict()
  .refine((v) => v.phone || v.email, { message: "Phone or email is required", path: ["phone"] });

/** ثبت پیام فرم تماس/پشتیبانی/شکایت (مهمان یا کاربر واردشده) */
export async function createTicket(db: DbOrTx, actor: Actor | null, input: unknown) {
  const data = parseInput(ticketSchema, input);
  const [row] = await db.insert(supportTickets).values({ ...data, userId: actor?.userId ?? null }).returning({ id: supportTickets.id });
  return row!;
}

const reportSchema = z.object({ reviewId: z.uuid(), reason: z.string().trim().min(10).max(1000) }).strict();

/** گزارش نظر نامناسب توسط کاربر واردشده (برای بررسی ادمین) */
export async function reportReview(db: DbOrTx, actor: Actor, name: string, input: unknown) {
  const { reviewId, reason } = parseInput(reportSchema, input);
  const [review] = await db.select({ id: reviews.id, salonId: reviews.salonId }).from(reviews).where(eq(reviews.id, reviewId)).limit(1);
  if (!review) throw new NotFoundError("Review");
  const [row] = await db
    .insert(supportTickets)
    .values({ kind: "review_report", userId: actor.userId, name: name.slice(0, 80) || "کاربر", subject: "گزارش نظر نامناسب", message: reason, reviewId, salonId: review.salonId })
    .returning({ id: supportTickets.id });
  return row!;
}

const assertAdmin = (a: Actor) => {
  if (a.role !== "admin") throw new ForbiddenError();
};

export async function listTickets(db: DbOrTx, actor: Actor, filter: { status?: string; kind?: string }) {
  assertAdmin(actor);
  const cond = [];
  if (filter.status && (ticketStatus.enumValues as readonly string[]).includes(filter.status)) cond.push(eq(supportTickets.status, filter.status as never));
  if (filter.kind && (ticketKind.enumValues as readonly string[]).includes(filter.kind)) cond.push(eq(supportTickets.kind, filter.kind as never));
  return db.select().from(supportTickets).where(cond.length ? and(...cond) : undefined).orderBy(desc(supportTickets.createdAt)).limit(200);
}

const updateSchema = z.object({ ticketId: z.uuid(), status: z.enum(ticketStatus.enumValues), adminNote: z.string().trim().max(2000).optional() }).strict();

export async function updateTicket(db: DbOrTx, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const { ticketId, ...data } = parseInput(updateSchema, input);
  const [row] = await db.update(supportTickets).set(data).where(eq(supportTickets.id, ticketId)).returning();
  if (!row) throw new NotFoundError("Ticket");
  return row;
}
