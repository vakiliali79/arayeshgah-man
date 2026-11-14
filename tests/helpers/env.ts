import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), true);

/** آدرس دیتابیس تست. برای جلوگیری از پاک شدن داده‌های واقعی، نام دیتابیس باید با _test تمام شود. */
export function getTestDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is not set (see .env.example)");
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) throw new Error(`Refusing to run tests against "${dbName}" (name must end with _test)`);
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === url) throw new Error("DATABASE_URL_TEST must differ from DATABASE_URL");
  return url;
}
