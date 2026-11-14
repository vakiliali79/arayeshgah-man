/**
 * ارتقای یک کاربر موجود به admin — تنها راه ساخت ادمین (ثبت‌نام عمومی هرگز admin نمی‌سازد).
 *   npm run db:create-admin -- 09121234567
 *   npm run db:create-admin -- --email admin@example.com --phone 09121234567   (افزودن شماره ورود به حساب قدیمی)
 * دسترسی مستقیم به دیتابیس لازم است؛ این اسکریپت از وب قابل فراخوانی نیست.
 */
import { requireEnv } from "./env";
import { eq } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { profiles, users } from "../src/db/schema";
import { normalizeIranMobile, toLocalPhone } from "../src/server/otp/phone";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const rawPhone = arg("phone") ?? (process.argv[2]?.startsWith("--") ? undefined : process.argv[2]);
  const phone = rawPhone ? normalizeIranMobile(rawPhone) : null;
  if (!phone) throw new Error("Usage: npm run db:create-admin -- <mobile>  |  --email <email> --phone <mobile>");

  const db = createDb(requireEnv("DATABASE_URL"), { max: 1 });
  try {
    await db.transaction(async (tx) => {
      const [user] = email
        ? await tx.select({ id: users.id, phoneNumber: users.phoneNumber }).from(users).where(eq(users.email, email)).limit(1)
        : await tx.select({ id: users.id, phoneNumber: users.phoneNumber }).from(users).where(eq(users.phoneNumber, phone)).limit(1);
      if (!user) throw new Error(email ? `No user with email ${email}` : `No user with mobile ${toLocalPhone(phone)}`);
      if (email && user.phoneNumber !== phone) {
        await tx.update(users).set({ phoneNumber: phone, phoneNumberVerified: false }).where(eq(users.id, user.id));
      }
      await tx
        .insert(profiles)
        .values({ userId: user.id, role: "admin", roleSelectedAt: new Date(), phone: toLocalPhone(phone) })
        .onConflictDoUpdate({ target: profiles.userId, set: { role: "admin", roleSelectedAt: new Date(), phone: toLocalPhone(phone) } });
    });
    console.log(`✓ ${toLocalPhone(phone)} is now an admin (sign in with this mobile number + OTP)`);
  } finally {
    await db.$client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
