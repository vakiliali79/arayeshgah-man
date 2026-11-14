/**
 * فقط برای CLI رسمی Better Auth (`npm run auth:generate`) — در برنامه import نشود.
 * (src/server/auth/index.ts به دلیل server-only توسط CLI قابل بارگذاری نیست.)
 */
import { createDb } from "@/db/client";
import { createAuth } from "./better-auth";

export const auth = createAuth(createDb(process.env.DATABASE_URL ?? "postgres://localhost/placeholder"), {
  otp: { mode: "static", code: "0000", allowedIps: null },
});
