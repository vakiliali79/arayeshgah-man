import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import { getFileServiceDeps } from "@/server/storage";

const PUBLIC_PURPOSES = ["avatar", "salon_cover", "salon_gallery", "portfolio"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * نمایش تصاویر عمومی (آواتار، تصاویر سالن، نمونه‌کار) از ذخیره‌ساز خارج از public.
 * فقط فایل‌های حذف‌نشده با کاربرد عمومی؛ نوع محتوا از متادیتای اعتبارسنجی‌شده هنگام آپلود.
 */
export async function GET(_req: Request, { params }: RouteContext<"/api/files/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), isNull(files.deletedAt), inArray(files.purpose, [...PUBLIC_PURPOSES])))
    .limit(1);
  if (!file) return new Response("Not found", { status: 404 });
  try {
    const data = await getFileServiceDeps().storage.read(file.storageKey);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(data.byteLength),
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
        ETag: `"${file.sha256}"`,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
