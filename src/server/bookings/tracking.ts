import { randomInt } from "node:crypto";

/** حروف بدون ابهام (بدون O/0/I/1) */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** کد پیگیری قابل نمایش به مشتری، مثل AM-7K3P9QXZ4M (تصادفی رمزنگاری‌شده؛ قابل حدس نیست) */
export function generateTrackingCode(): string {
  let code = "";
  for (let i = 0; i < 10; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `AM-${code}`;
}

export const TRACKING_CODE_PATTERN = /^AM-[A-Z0-9]{10}$/;
