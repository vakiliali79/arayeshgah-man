import "server-only";

import { db } from "@/db";
import { createMailerFromEnv } from "@/server/mail/mailer";
import { createAuth, type Auth } from "./better-auth";

const globalForAuth = globalThis as unknown as { __arayeshgahAuth?: Auth };

/** نمونه یکتای Better Auth برای برنامه (route handler، server actions، server components) */
export const auth: Auth = globalForAuth.__arayeshgahAuth ?? createAuth(db, { mailer: createMailerFromEnv() });
if (process.env.NODE_ENV !== "production") globalForAuth.__arayeshgahAuth = auth;
