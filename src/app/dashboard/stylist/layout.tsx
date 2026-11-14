import { requireSession } from "@/server/auth/current";

/** فقط نقش stylist (بررسی سمت سرور) */
export default async function StylistLayout({ children }: { children: React.ReactNode }) {
  await requireSession(["stylist"]);
  return children;
}
