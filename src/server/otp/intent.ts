import { AsyncLocalStorage } from "node:async_hooks";
import type { SelfAssignableRole } from "@/config/roles";

/**
 * «نیت ثبت‌نام» در محدوده همان درخواست سمت سرور.
 * Better Auth فقط وقتی کاربر جدید می‌سازد که تأیید OTP داخل این محدوده (فرایند ثبت‌نام برنامه)
 * انجام شود؛ فراخوانی مستقیم ‎/api/auth/phone-number/verify‎ برای شماره ثبت‌نشده حساب نمی‌سازد.
 */
export interface RegistrationIntent {
  phoneNumber: string;
  fullName: string;
  role: SelfAssignableRole;
}

const storage = new AsyncLocalStorage<RegistrationIntent>();

export const withRegistrationIntent = <T>(intent: RegistrationIntent, fn: () => Promise<T>) => storage.run(intent, fn);

export function getRegistrationIntent(phoneNumber?: string): RegistrationIntent | undefined {
  const intent = storage.getStore();
  if (!intent) return undefined;
  return phoneNumber === undefined || intent.phoneNumber === phoneNumber ? intent : undefined;
}
