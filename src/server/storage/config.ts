import path from "node:path";

export const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type AllowedMimeType = keyof typeof ALLOWED_IMAGE_TYPES;

export const PRODUCTION_UPLOAD_DIR = "/var/lib/arayeshgahman/uploads";
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

export interface StorageConfig {
  rootDir: string;
  maxBytes: number;
}

/**
 * مسیر ذخیره‌سازی همیشه خارج از public است تا فایل‌ها فقط از طریق مسیرهای
 * کنترل‌شده (با بررسی دسترسی) سرو شوند.
 */
export function getStorageConfig(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  const configured = env.UPLOAD_DIR?.trim();
  const rootDir = path.resolve(
    configured || (env.NODE_ENV === "production" ? PRODUCTION_UPLOAD_DIR : path.join(process.cwd(), ".data", "uploads")),
  );

  const publicDir = path.resolve(process.cwd(), "public");
  if (rootDir === publicDir || rootDir.startsWith(publicDir + path.sep)) {
    throw new Error("UPLOAD_DIR must not be inside the public web root");
  }

  const maxBytes = Number(env.UPLOAD_MAX_BYTES ?? DEFAULT_MAX_BYTES);
  if (!Number.isInteger(maxBytes) || maxBytes <= 0 || maxBytes > 50 * 1024 * 1024) {
    throw new Error("UPLOAD_MAX_BYTES must be a positive integer ≤ 50MB");
  }
  return { rootDir, maxBytes };
}
