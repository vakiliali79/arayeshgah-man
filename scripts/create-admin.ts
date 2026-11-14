/**
 * ارتقای یک کاربر موجود به admin — تنها راه ساخت ادمین (ثبت‌نام عمومی هرگز admin نمی‌سازد).
 *   npm run db:create-admin -- user@example.com
 * دسترسی مستقیم به دیتابیس لازم است؛ این اسکریپت از وب قابل فراخوانی نیست.
 */
import { requireEnv } from "./env";
import { eq } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { profiles, users } from "../src/db/schema";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run db:create-admin -- <email>");
  const db = createDb(requireEnv("DATABASE_URL"), { max: 1 });
  try {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (!user) throw new Error(`No user with email ${email}`);
    await db
      .insert(profiles)
      .values({ userId: user.id, role: "admin", roleSelectedAt: new Date() })
      .onConflictDoUpdate({ target: profiles.userId, set: { role: "admin", roleSelectedAt: new Date() } });
    console.log(`✓ ${email} is now an admin`);
  } finally {
    await db.$client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
