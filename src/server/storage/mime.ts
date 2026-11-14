import type { AllowedMimeType } from "./config";

const startsWith = (buf: Uint8Array, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

/**
 * تشخیص نوع فایل از روی محتوای واقعی (magic bytes)، نه پسوند یا Content-Type ارسالی کلاینت.
 * فقط JPEG / PNG / WebP پذیرفته می‌شوند (SVG به دلیل امکان اجرای اسکریپت پذیرفته نمی‌شود).
 */
export function detectImageMime(buf: Uint8Array): AllowedMimeType | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // RIFF....WEBP
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}
