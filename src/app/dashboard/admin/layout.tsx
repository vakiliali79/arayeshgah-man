import { requireSession } from "@/server/auth/current";

/** فقط مدیر کل (بررسی سمت سرور؛ هر عمل ادمین دوباره در سرویس بررسی می‌شود) */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSession(["admin"]);
  return children;
}
