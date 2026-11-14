/**
 * اجرای مایگریشن‌های پوشه drizzle/ (روش برنامه‌نویسی رسمی Drizzle).
 *   npm run db:migrate
 * برای استفاده در CI/استقرار که drizzle-kit (devDependency) در دسترس نیست.
 */
import { requireEnv } from "./env";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "../src/db/client";

async function main() {
  const db = createDb(requireEnv("DATABASE_URL"), { max: 1 });
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✓ migrations applied");
  } finally {
    await db.$client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
