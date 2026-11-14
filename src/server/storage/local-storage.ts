import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { ALLOWED_IMAGE_TYPES, type AllowedMimeType } from "./config";

const KEY_PATTERN = /^[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

/**
 * ذخیره‌ساز فایل محلی.
 * - نام فایل همیشه UUID تصادفی است (نام اصلی کاربر هرگز در مسیر استفاده نمی‌شود)
 * - کلیدها با الگوی سخت‌گیرانه بررسی و مسیر نهایی در محدوده ریشه تضمین می‌شود (ضد path traversal)
 * - فایل با فلگ wx (عدم بازنویسی) و مجوز 0640 نوشته می‌شود
 */
export class LocalFileStorage {
  readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  private resolveKey(key: string): string {
    if (!KEY_PATTERN.test(key)) throw new Error("Invalid storage key");
    const full = path.resolve(this.rootDir, key);
    if (!full.startsWith(this.rootDir + path.sep)) throw new Error("Storage key escapes root directory");
    return full;
  }

  async put(data: Uint8Array, mimeType: AllowedMimeType): Promise<string> {
    const id = randomUUID();
    const key = `${id.slice(0, 2)}/${id.slice(2, 4)}/${id}.${ALLOWED_IMAGE_TYPES[mimeType]}`;
    const full = this.resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true, mode: 0o750 });
    const handle = await open(full, "wx", 0o640);
    try {
      await handle.writeFile(data);
    } catch (err) {
      await handle.close();
      await rm(full, { force: true });
      throw err;
    }
    await handle.close();
    return key;
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }
}
