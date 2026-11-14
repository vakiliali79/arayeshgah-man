import "server-only";

import { createDb, type Database } from "./client";

export * from "./client";

const globalForDb = globalThis as unknown as { __arayeshgahDb?: Database };

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  return url;
}

/**
 * اتصال singleton برنامه. در حالت توسعه روی globalThis نگه داشته می‌شود
 * تا HMR تعداد Poolها را زیاد نکند. اتصال تا اولین کوئری برقرار نمی‌شود.
 */
export const db: Database = globalForDb.__arayeshgahDb ?? createDb(getDatabaseUrl());
if (process.env.NODE_ENV !== "production") globalForDb.__arayeshgahDb = db;
