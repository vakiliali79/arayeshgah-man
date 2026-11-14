import { eq } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "@/db/client";
import { siteSettings } from "@/db/schema";
import type { Actor } from "../auth/actor";
import { ForbiddenError } from "../errors";
import { parseInput } from "../validation";

const optText = (max: number) => z.string().trim().max(max).optional();

/** طرح هر کلید تنظیمات/محتوا (هیچ مقدار پیش‌فرض ساختگی؛ خالی = نمایش «به‌زودی») */
export const SETTING_SCHEMAS = {
  contact: z
    .object({
      phone: optText(30),
      email: z.union([z.literal(""), z.email().max(120)]).optional(),
      address: optText(300),
      hours: optText(120),
      instagram: optText(60),
      telegram: optText(60),
    })
    .strict(),
  about: z.object({ body: optText(6000) }).strict(),
  careers: z
    .object({
      intro: optText(2000),
      openings: z.array(z.object({ title: z.string().trim().min(2).max(120), type: optText(60), description: optText(1000) }).strict()).max(30).default([]),
    })
    .strict(),
  announcement: z.object({ text: optText(200), active: z.boolean().default(false) }).strict(),
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type SettingValue<K extends SettingKey> = z.output<(typeof SETTING_SCHEMAS)[K]>;

export async function getSetting<K extends SettingKey>(db: DbOrTx, key: K): Promise<SettingValue<K> | null> {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
  if (!row) return null;
  const parsed = SETTING_SCHEMAS[key].safeParse(row.value);
  return parsed.success ? (parsed.data as SettingValue<K>) : null;
}

/** ذخیره تنظیمات — فقط ادمین؛ مقدار با طرح همان کلید اعتبارسنجی می‌شود */
export async function setSetting<K extends SettingKey>(db: DbOrTx, actor: Actor, key: K, value: unknown) {
  if (actor.role !== "admin") throw new ForbiddenError();
  const data = parseInput(SETTING_SCHEMAS[key], value);
  await db
    .insert(siteSettings)
    .values({ key, value: data, updatedBy: actor.userId })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: data, updatedBy: actor.userId, updatedAt: new Date() } });
  return data;
}
