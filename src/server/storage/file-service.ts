import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { filePurpose, files, portfolioItems, profiles, salons } from "@/db/schema";
import type { StoredFile } from "@/db/types";
import { isAdmin, type Actor } from "../auth/actor";
import { assertSalonPermission, getStylistByUserId } from "../auth/permissions";
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import type { StorageConfig } from "./config";
import type { LocalFileStorage } from "./local-storage";
import { detectImageMime } from "./mime";

const uploadMetaSchema = z
  .object({
    purpose: z.enum(filePurpose.enumValues),
    /** برای salon_cover / salon_gallery و نمونه‌کار سالن */
    salonId: z.uuid().optional(),
    originalName: z.string().max(255).optional(),
    declaredMimeType: z.string().max(100).optional(),
  })
  .strict();

/** نام اصلی فقط برای نمایش ذخیره می‌شود؛ مسیر و کاراکترهای کنترلی حذف می‌شوند */
function sanitizeOriginalName(name?: string): string | null {
  if (!name) return null;
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
  return clean || null;
}

async function authorizeUpload(db: Database, actor: Actor, purpose: StoredFile["purpose"], salonId?: string) {
  switch (purpose) {
    case "avatar":
      return; // هر کاربر واردشده برای خودش
    case "salon_cover":
    case "salon_gallery":
      if (!salonId) throw new ValidationError("salonId is required", { salonId: "Required" });
      await assertSalonPermission(db, actor, salonId, "manage_salon");
      return;
    case "portfolio":
      if (salonId) {
        await assertSalonPermission(db, actor, salonId, "manage_portfolio");
        return;
      }
      if (isAdmin(actor)) return;
      if (!(await getStylistByUserId(db, actor.userId))) throw new ForbiddenError("Only stylists can upload portfolio items");
      return;
  }
}

export interface FileServiceDeps {
  db: Database;
  storage: LocalFileStorage;
  config: StorageConfig;
}

/**
 * آپلود امن: بررسی دسترسی → محدودیت حجم → تشخیص MIME از محتوا → ذخیره با نام یکتا → ثبت متادیتا.
 * اگر ثبت در دیتابیس شکست بخورد، فایل نوشته‌شده پاک می‌شود.
 */
export async function uploadFile(deps: FileServiceDeps, actor: Actor, data: Uint8Array, meta: unknown): Promise<StoredFile> {
  const m = parseInput(uploadMetaSchema, meta);
  await authorizeUpload(deps.db, actor, m.purpose, m.salonId);

  if (data.byteLength === 0) throw new ValidationError("File is empty");
  if (data.byteLength > deps.config.maxBytes) {
    throw new BusinessRuleError("FILE_TOO_LARGE", `File exceeds the ${deps.config.maxBytes} byte limit`);
  }
  const mimeType = detectImageMime(data);
  if (!mimeType) throw new BusinessRuleError("UNSUPPORTED_FILE_TYPE", "Only JPEG, PNG and WebP images are allowed");
  if (m.declaredMimeType && m.declaredMimeType !== mimeType) {
    throw new BusinessRuleError("MIME_MISMATCH", "File content does not match its declared type");
  }

  const sha256 = createHash("sha256").update(data).digest("hex");
  const key = await deps.storage.put(data, mimeType);
  try {
    const [row] = await deps.db
      .insert(files)
      .values({
        ownerId: actor.userId,
        purpose: m.purpose,
        storageKey: key,
        originalName: sanitizeOriginalName(m.originalName),
        mimeType,
        sizeBytes: data.byteLength,
        sha256,
      })
      .returning();
    return row!;
  } catch (err) {
    await deps.storage.delete(key).catch(() => {});
    throw err;
  }
}

/**
 * حذف امن: فقط مالک فایل یا ادمین. فایلی که هنوز در نمونه‌کار استفاده شده حذف نمی‌شود.
 * ابتدا در تراکنش متادیتا حذف نرم و ارجاع‌ها پاک می‌شوند، سپس فایل از دیسک حذف می‌شود.
 */
export async function deleteFile(deps: FileServiceDeps, actor: Actor, fileId: string): Promise<void> {
  const key = await deps.db.transaction(async (tx) => {
    const [file] = await tx.select().from(files).where(and(eq(files.id, fileId), isNull(files.deletedAt))).for("update").limit(1);
    if (!file) throw new NotFoundError("File");
    if (file.ownerId !== actor.userId && !isAdmin(actor)) throw new ForbiddenError();

    const [usedInPortfolio] = await tx.select({ id: portfolioItems.id }).from(portfolioItems).where(eq(portfolioItems.fileId, file.id)).limit(1);
    if (usedInPortfolio) throw new BusinessRuleError("FILE_IN_USE", "Remove the portfolio item before deleting its image");

    await tx.update(profiles).set({ avatarFileId: null }).where(eq(profiles.avatarFileId, file.id));
    await tx.update(salons).set({ coverFileId: null }).where(eq(salons.coverFileId, file.id));
    await tx.update(files).set({ deletedAt: new Date() }).where(eq(files.id, file.id));
    return file.storageKey;
  });
  await deps.storage.delete(key);
}

/** خواندن فایل برای سرو از طریق route handler (بررسی دسترسی بر عهده فراخواننده) */
export async function readFileContent(deps: FileServiceDeps, fileId: string) {
  const [file] = await deps.db.select().from(files).where(and(eq(files.id, fileId), isNull(files.deletedAt))).limit(1);
  if (!file) throw new NotFoundError("File");
  return { file, data: await deps.storage.read(file.storageKey) };
}
