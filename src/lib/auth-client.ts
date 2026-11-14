"use client";

import { createAuthClient } from "better-auth/react";

/**
 * کلاینت Better Auth برای کامپوننت‌های سمت کلاینت (useSession، signOut، ...).
 * هم‌مبدأ با سایت است، پس baseURL لازم نیست. هیچ راز یا نقشی در کلاینت نگه‌داری نمی‌شود؛
 * نقش همیشه سمت سرور از جدول profiles خوانده می‌شود.
 */
export const authClient = createAuthClient();

export const { useSession, signOut } = authClient;
