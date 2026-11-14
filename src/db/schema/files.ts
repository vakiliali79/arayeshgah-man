import { sql } from "drizzle-orm";
import { bigint, check, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, tstz } from "./_shared";
import { users } from "./auth";
import { filePurpose } from "./enums";

/**
 * متادیتای فایل‌های آپلودشده. خود فایل روی دیسک (خارج از public) ذخیره می‌شود،
 * نه در PostgreSQL. storage_key مسیر نسبی داخل UPLOAD_DIR است.
 */
export const files = pgTable(
  "files",
  {
    id: id(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    purpose: filePurpose("purpose").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    originalName: text("original_name"),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256").notNull(),
    width: integer("width"),
    height: integer("height"),
    createdAt: tstz("created_at").notNull().defaultNow(),
    deletedAt: tstz("deleted_at"),
  },
  (t) => [
    index("files_owner_idx").on(t.ownerId),
    check("files_size_positive", sql`${t.sizeBytes} > 0`),
    check("files_mime_allowed", sql`${t.mimeType} in ('image/jpeg', 'image/png', 'image/webp')`),
    check("files_storage_key_safe", sql`${t.storageKey} !~ '(^/|\\.\\.)'`),
    check("files_sha256_format", sql`${t.sha256} ~ '^[0-9a-f]{64}$'`),
  ],
);
