import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { files } from "@/db/schema";
import { BusinessRuleError, ForbiddenError } from "@/server/errors";
import { getStorageConfig } from "@/server/storage/config";
import { deleteFile, uploadFile, type FileServiceDeps } from "@/server/storage/file-service";
import { LocalFileStorage } from "@/server/storage/local-storage";
import { closeTestDb, getTestDb, makeSalonScenario, makeUser, resetDb } from "./helpers/db";

const db = getTestDb();
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

let root: string;
let deps: FileServiceDeps;

describe("local file storage", () => {
  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "arayeshgah-uploads-"));
    deps = { db, storage: new LocalFileStorage(root), config: { rootDir: root, maxBytes: 1024 } };
  });
  beforeEach(() => resetDb(db));
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
    await closeTestDb();
  });

  it("stores the file outside the web root with a random name and records metadata", async () => {
    const u = await makeUser(db);
    const row = await uploadFile(deps, u, PNG, { purpose: "avatar", originalName: "../../etc/عکس من.png" });
    expect(row.storageKey).toMatch(/^[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f-]{36}\.png$/);
    expect(row.originalName).toBe("عکس من.png"); // مسیر حذف شده
    expect(row).toMatchObject({ mimeType: "image/png", sizeBytes: PNG.length, ownerId: u.userId });
    const onDisk = path.join(root, row.storageKey);
    expect(await readFile(onDisk)).toEqual(PNG);
    expect((await stat(onDisk)).mode & 0o777).toBe(0o640);
  });

  it("detects the type from content, not the declared type or name", async () => {
    const u = await makeUser(db);
    const fake = Buffer.from("not really an image");
    await expect(uploadFile(deps, u, fake, { purpose: "avatar", originalName: "x.png", declaredMimeType: "image/png" })).rejects.toMatchObject({
      code: "UNSUPPORTED_FILE_TYPE",
    });
    await expect(uploadFile(deps, u, SVG, { purpose: "avatar" })).rejects.toMatchObject({ code: "UNSUPPORTED_FILE_TYPE" });
    await expect(uploadFile(deps, u, JPEG, { purpose: "avatar", declaredMimeType: "image/png" })).rejects.toMatchObject({ code: "MIME_MISMATCH" });
  });

  it("enforces the size limit", async () => {
    const u = await makeUser(db);
    const big = Buffer.concat([PNG, Buffer.alloc(2048)]);
    await expect(uploadFile(deps, u, big, { purpose: "avatar" })).rejects.toBeInstanceOf(BusinessRuleError);
    expect(await db.select().from(files)).toHaveLength(0);
  });

  it("requires salon permissions for salon images and a stylist profile for portfolio", async () => {
    const s = await makeSalonScenario(db);
    const customer = await makeUser(db);
    await expect(uploadFile(deps, customer, PNG, { purpose: "salon_cover", salonId: s.salon.id })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(uploadFile(deps, s.owner, PNG, { purpose: "salon_cover", salonId: s.salon.id })).resolves.toMatchObject({ purpose: "salon_cover" });
    await expect(uploadFile(deps, customer, PNG, { purpose: "portfolio" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(uploadFile(deps, s.stylistUser, PNG, { purpose: "portfolio" })).resolves.toMatchObject({ purpose: "portfolio" });
  });

  it("only the owner (or an admin) can delete; deletion removes the file and soft-deletes metadata", async () => {
    const owner = await makeUser(db);
    const other = await makeUser(db);
    const row = await uploadFile(deps, owner, PNG, { purpose: "avatar" });
    await expect(deleteFile(deps, other, row.id)).rejects.toBeInstanceOf(ForbiddenError);
    await deleteFile(deps, owner, row.id);
    await expect(stat(path.join(root, row.storageKey))).rejects.toMatchObject({ code: "ENOENT" });
    const [meta] = await db.select().from(files).where(eq(files.id, row.id));
    expect(meta!.deletedAt).toBeInstanceOf(Date);
  });

  it("rejects path traversal storage keys", async () => {
    const storage = new LocalFileStorage(root);
    await expect(storage.read("../../etc/passwd")).rejects.toThrow("Invalid storage key");
    await expect(storage.delete("aa/bb/../../../x.png")).rejects.toThrow("Invalid storage key");
  });

  it("refuses an upload directory inside the public web root", () => {
    expect(() => getStorageConfig({ UPLOAD_DIR: path.join(process.cwd(), "public", "uploads"), NODE_ENV: "test" } as NodeJS.ProcessEnv)).toThrow(
      /public/,
    );
    expect(getStorageConfig({ NODE_ENV: "production" } as NodeJS.ProcessEnv).rootDir).toBe("/var/lib/arayeshgahman/uploads");
  });
});
