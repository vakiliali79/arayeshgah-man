import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { getTestDatabaseUrl } from "./helpers/env";

/** دیتابیس تست را از صفر می‌سازد و همه مایگریشن‌ها را اعمال می‌کند */
export default async function setup() {
  const db = createDb(getTestDatabaseUrl(), { max: 1 });
  try {
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await db.$client.end();
  }
}
