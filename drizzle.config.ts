import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// همان ترتیب بارگذاری env در Next.js (.env.local و ...)
loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
