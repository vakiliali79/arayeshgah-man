import { loadEnvConfig } from "@next/env";

/** بارگذاری env با همان ترتیب Next.js (.env, .env.local, .env.[mode]...) برای اسکریپت‌های CLI */
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

/** جلوگیری از اجرای اسکریپت‌های مخرب روی دیتابیس غیرمحلی/تولید */
export function assertSafeLocalDatabase(url: string, allowFlag: string) {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run in NODE_ENV=production");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host) && process.env[allowFlag] !== "1") {
    throw new Error(`Refusing to run against non-local host "${host}". Set ${allowFlag}=1 to override.`);
  }
}
