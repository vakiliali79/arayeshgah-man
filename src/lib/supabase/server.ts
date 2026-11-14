import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

/** کلاینت Supabase برای Server Components، Server Actions و Route Handlers */
export async function createClient() {
  const env = getSupabaseEnv();
  if (!env) throw new Error("Supabase env vars are missing (see .env.example)");
  const cookieStore = await cookies();

  return createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // در Server Component امکان نوشتن کوکی نیست؛ proxy نشست را تازه می‌کند.
        }
      },
    },
  });
}
