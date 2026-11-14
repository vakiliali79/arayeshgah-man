import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database, DbOrTx } from "@/db/client";
import { notifications, profiles, reviews, supportTicketMessages, supportTickets, users } from "@/db/schema";
import { ticketKind, ticketStatus } from "@/db/schema";
import { recordAudit } from "../admin/audit";
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

const likeTerm = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

export async function listTickets(db: DbOrTx, actor: Actor, filter: { status?: string; kind?: string; q?: string }) {
  assertAdmin(actor);
  const cond = [];
  if (filter.status && (ticketStatus.enumValues as readonly string[]).includes(filter.status)) cond.push(eq(supportTickets.status, filter.status as never));
  if (filter.kind && (ticketKind.enumValues as readonly string[]).includes(filter.kind)) cond.push(eq(supportTickets.kind, filter.kind as never));
  const q = filter.q?.trim();
  if (q) cond.push(or(ilike(supportTickets.subject, likeTerm(q)), ilike(supportTickets.name, likeTerm(q)), ilike(supportTickets.phone, likeTerm(q)), ilike(supportTickets.email, likeTerm(q))));
  return db
    .select({
      ...TICKET_COLUMNS,
      messages: sql<number>`(select count(*)::int from ${supportTicketMessages} m where m.ticket_id = "support_tickets"."id")`,
    })
    .from(supportTickets)
    .where(cond.length ? and(...cond) : undefined)
    .orderBy(desc(supportTickets.createdAt))
    .limit(200);
}

const TICKET_COLUMNS = {
  id: supportTickets.id, kind: supportTickets.kind, status: supportTickets.status, userId: supportTickets.userId, name: supportTickets.name, phone: supportTickets.phone,
  email: supportTickets.email, subject: supportTickets.subject, message: supportTickets.message, reviewId: supportTickets.reviewId, salonId: supportTickets.salonId,
  bookingId: supportTickets.bookingId, adminNote: supportTickets.adminNote, createdAt: supportTickets.createdAt, updatedAt: supportTickets.updatedAt,
};

export async function ticketCountsByStatus(db: DbOrTx, actor: Actor) {
  assertAdmin(actor);
  const rows = await db.select({ status: supportTickets.status, n: count() }).from(supportTickets).groupBy(supportTickets.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
}

const messageColumns = {
  id: supportTicketMessages.id, kind: supportTicketMessages.kind, body: supportTicketMessages.body, createdAt: supportTicketMessages.createdAt,
  authorId: supportTicketMessages.authorId, authorName: sql<string | null>`coalesce(${profiles.fullName}, ${users.name})`,
};

/** جزئیات درخواست + تاریخچه کامل پیگیری (برای مدیر) */
export async function getTicketDetail(db: DbOrTx, actor: Actor, ticketId: string) {
  assertAdmin(actor);
  if (!z.uuid().safeParse(ticketId).success) throw new NotFoundError("Ticket");
  const [ticket] = await db.select(TICKET_COLUMNS).from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  if (!ticket) throw new NotFoundError("Ticket");
  const messages = await db
    .select(messageColumns)
    .from(supportTicketMessages)
    .leftJoin(users, eq(users.id, supportTicketMessages.authorId))
    .leftJoin(profiles, eq(profiles.userId, supportTicketMessages.authorId))
    .where(eq(supportTicketMessages.ticketId, ticketId))
    .orderBy(asc(supportTicketMessages.createdAt));
  const [review] = ticket.reviewId ? await db.select().from(reviews).where(eq(reviews.id, ticket.reviewId)).limit(1) : [];
  return { ticket, messages, review: review ?? null };
}

const TICKET_STATUS_FA: Record<string, string> = { open: "باز", in_progress: "در حال بررسی", resolved: "رسیدگی‌شده", closed: "بسته‌شده" };

const messageSchema = z.object({ ticketId: z.uuid(), kind: z.enum(["reply", "note"]), body: z.string().trim().min(2).max(4000) }).strict();

/**
 * پاسخ مدیر (برای کاربر واردشده در داشبوردش قابل مشاهده است و اعلان می‌گیرد) یا یادداشت داخلی.
 * پاسخ به درخواست «باز»، وضعیت را «در حال بررسی» می‌کند.
 */
export async function addTicketMessage(db: Database, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const { ticketId, kind, body } = parseInput(messageSchema, input);
  return db.transaction(async (tx) => {
    const [t] = await tx.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).for("update").limit(1);
    if (!t) throw new NotFoundError("Ticket");
    const [msg] = await tx.insert(supportTicketMessages).values({ ticketId, authorId: actor.userId, kind, body }).returning();
    if (kind === "reply") {
      if (t.status === "open") {
        await tx.update(supportTickets).set({ status: "in_progress" }).where(eq(supportTickets.id, ticketId));
        await tx.insert(supportTicketMessages).values({ ticketId, authorId: actor.userId, kind: "status", body: `وضعیت: ${TICKET_STATUS_FA.open} ← ${TICKET_STATUS_FA.in_progress}` });
      }
      if (t.userId) {
        await tx.insert(notifications).values({ userId: t.userId, type: "system", title: "پاسخ به درخواست پشتیبانی", body: t.subject, data: { ticketId } });
      }
    }
    await recordAudit(tx, actor, { action: kind === "reply" ? "ticket.reply" : "ticket.note", targetType: "ticket", targetId: ticketId, summary: t.subject });
    return msg!;
  });
}

const statusSchema = z.object({ ticketId: z.uuid(), status: z.enum(ticketStatus.enumValues), note: z.string().trim().max(1000).optional() }).strict();

/** تغییر وضعیت با ثبت در تاریخچه پیگیری */
export async function setTicketStatus(db: Database, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const { ticketId, status, note } = parseInput(statusSchema, input);
  return db.transaction(async (tx) => {
    const [t] = await tx.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).for("update").limit(1);
    if (!t) throw new NotFoundError("Ticket");
    if (t.status === status) return t;
    const [row] = await tx.update(supportTickets).set({ status }).where(eq(supportTickets.id, ticketId)).returning();
    await tx.insert(supportTicketMessages).values({
      ticketId, authorId: actor.userId, kind: "status", body: `وضعیت: ${TICKET_STATUS_FA[t.status]} ← ${TICKET_STATUS_FA[status]}${note ? ` — ${note}` : ""}`,
    });
    await recordAudit(tx, actor, { action: "ticket.status", targetType: "ticket", targetId: ticketId, summary: t.subject, reason: note, changes: { status: { from: t.status, to: status } } });
    return row!;
  });
}

/** درخواست‌های خود کاربر واردشده + پاسخ‌ها و تغییر وضعیت‌ها (یادداشت داخلی مدیر نمایش داده نمی‌شود) */
export async function listMyTickets(db: DbOrTx, actor: Actor) {
  const tickets = await db
    .select(TICKET_COLUMNS)
    .from(supportTickets)
    .where(and(eq(supportTickets.userId, actor.userId), ne(supportTickets.kind, "review_report")))
    .orderBy(desc(supportTickets.createdAt))
    .limit(50);
  const messages = tickets.length
    ? await db
        .select({ ...messageColumns, ticketId: supportTicketMessages.ticketId })
        .from(supportTicketMessages)
        .leftJoin(users, eq(users.id, supportTicketMessages.authorId))
        .leftJoin(profiles, eq(profiles.userId, supportTicketMessages.authorId))
        .where(and(inArray(supportTicketMessages.ticketId, tickets.map((t) => t.id)), inArray(supportTicketMessages.kind, ["reply", "status"])))
        .orderBy(asc(supportTicketMessages.createdAt))
    : [];
  // یادداشت قدیمی مدیر (adminNote) داخلی است و به کاربر برگردانده نمی‌شود
  return tickets.map((t) => ({ id: t.id, kind: t.kind, status: t.status, subject: t.subject, message: t.message, createdAt: t.createdAt, messages: messages.filter((m) => m.ticketId === t.id) }));
}

const updateSchema = z.object({ ticketId: z.uuid(), status: z.enum(ticketStatus.enumValues), adminNote: z.string().trim().max(2000).optional() }).strict();

/** سازگاری با نسخه قبلی (وضعیت + یادداشت داخلی تکی) */
export async function updateTicket(db: Database, actor: Actor, input: unknown) {
  assertAdmin(actor);
  const { ticketId, status, adminNote } = parseInput(updateSchema, input);
  await setTicketStatus(db, actor, { ticketId, status });
  if (adminNote) await addTicketMessage(db, actor, { ticketId, kind: "note", body: adminNote });
  const [row] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  return row!;
}
