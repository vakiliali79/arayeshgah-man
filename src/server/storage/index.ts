import "server-only";

import { db } from "@/db";
import { getStorageConfig } from "./config";
import type { FileServiceDeps } from "./file-service";
import { LocalFileStorage } from "./local-storage";

let deps: FileServiceDeps | undefined;

/** وابستگی‌های پیش‌فرض ذخیره‌سازی برای کد برنامه */
export function getFileServiceDeps(): FileServiceDeps {
  if (!deps) {
    const config = getStorageConfig();
    deps = { db, config, storage: new LocalFileStorage(config.rootDir) };
  }
  return deps;
}

export * from "./file-service";
export { ALLOWED_IMAGE_TYPES, PRODUCTION_UPLOAD_DIR } from "./config";
