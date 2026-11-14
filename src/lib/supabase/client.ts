"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

/** کلاینت Supabase برای کامپوننت‌های سمت کلاینت */
export function createClient() {
  const env = getSupabaseEnv();
  if (!env) throw new Error("Supabase env vars are missing (see .env.example)");
  return createBrowserClient<Database>(env.url, env.anonKey);
}
