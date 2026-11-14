import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema> & { $client: Pool };
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** هر جایی که هم اتصال اصلی و هم تراکنش پذیرفته می‌شود */
export type DbOrTx = Database | Transaction;

/**
 * ساخت یک نمونه Drizzle روی pg.Pool.
 * فقط در سرور/اسکریپت/تست استفاده شود؛ اطلاعات اتصال هرگز با پیشوند NEXT_PUBLIC تعریف نمی‌شود.
 */
export function createDb(connectionString: string, poolConfig: Omit<PoolConfig, "connectionString"> = {}): Database {
  if (!connectionString) throw new Error("Database connection string is empty");
  const pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000, ...poolConfig });
  return drizzle({ client: pool, schema });
}
