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
    expect(res.rows[0]?.n).toBe(6);
  });

  it("has the phone login columns with uniqueness and format constraints on users", async () => {
    const cols = await db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns where table_name = 'users' and column_name like 'phone%' order by 1`,
    );
    expect(cols.rows.map((r) => r.column_name)).toEqual(["phone_number", "phone_number_verified"]);
    const cons = await db.execute<{ conname: string }>(
      sql`select conname from pg_constraint where conrelid = 'users'::regclass and conname like 'users_phone%' order by 1`,
    );
    expect(cons.rows.map((r) => r.conname)).toEqual(["users_phone_number_format", "users_phone_number_unique"]);
    // ستون email (اجباری در مدل Better Auth) حفظ شده است
    const email = await db.execute<{ is_nullable: string }>(
      sql`select is_nullable from information_schema.columns where table_name = 'users' and column_name = 'email'`,
    );
    expect(email.rows[0]?.is_nullable).toBe("NO");
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

  it("creates all 25 tables (4 Better Auth + 21 application)", async () => {
    const res = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`,
    );
    expect(res.rows.map((r) => r.table_name)).toEqual([
      "accounts", "admin_audit_logs", "booking_events", "bookings", "favorites", "files", "notifications", "portfolio_items",
      "profiles", "reviews", "salon_members", "salons", "service_categories", "services", "sessions",
      "site_settings", "stylist_services", "stylists", "subscription_plans", "support_ticket_messages", "support_tickets", "users",
      "verifications", "working_hours", "working_time_off",
    ]);
  });
});
