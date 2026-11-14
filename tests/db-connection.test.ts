import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closeTestDb, getTestDb } from "./helpers/db";

describe("database connection", () => {
  const db = getTestDb();
  afterAll(closeTestDb);

  it("connects and runs a query", async () => {
    const res = await db.execute<{ ok: number }>(sql`select 1 as ok`);
    expect(res.rows[0]?.ok).toBe(1);
  });

  it("has all migrations applied", async () => {
    const res = await db.execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
    expect(res.rows[0]?.n).toBe(2);
  });

  it("has btree_gist and the booking exclusion constraints", async () => {
    const ext = await db.execute(sql`select 1 from pg_extension where extname = 'btree_gist'`);
    expect(ext.rows).toHaveLength(1);
    const cons = await db.execute<{ conname: string }>(sql`select conname from pg_constraint where contype = 'x' order by conname`);
    expect(cons.rows.map((r) => r.conname)).toEqual([
      "bookings_no_customer_overlap",
      "bookings_no_stylist_overlap",
      "working_hours_no_overlap",
    ]);
  });

  it("creates all 19 tables (4 Better Auth + 15 application)", async () => {
    const res = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`,
    );
    expect(res.rows.map((r) => r.table_name)).toEqual([
      "accounts", "booking_events", "bookings", "favorites", "files", "notifications", "portfolio_items",
      "profiles", "reviews", "salon_members", "salons", "services", "sessions", "stylist_services",
      "stylists", "users", "verifications", "working_hours", "working_time_off",
    ]);
  });
});
