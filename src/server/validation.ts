import type { z } from "zod";
import { ValidationError } from "./errors";

/** اعتبارسنجی ورودی سمت سرور؛ در صورت خطا ValidationError با خطاهای هر فیلد پرتاب می‌شود. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    fieldErrors[key] ??= issue.message;
  }
  throw new ValidationError("Invalid input", fieldErrors);
}
