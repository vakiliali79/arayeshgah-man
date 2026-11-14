import { asc, eq } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { serviceCategories } from "@/db/schema";

/** دسته‌بندی‌های فعال برای فرم‌ها و فیلترها (ترتیب و برچسب قابل مدیریت توسط ادمین) */
export async function listActiveCategories(db: DbOrTx) {
  return db
    .select({ key: serviceCategories.key, label: serviceCategories.label })
    .from(serviceCategories)
    .where(eq(serviceCategories.isActive, true))
    .orderBy(asc(serviceCategories.sortOrder));
}

export async function listAllCategories(db: DbOrTx) {
  return db.select().from(serviceCategories).orderBy(asc(serviceCategories.sortOrder));
}
