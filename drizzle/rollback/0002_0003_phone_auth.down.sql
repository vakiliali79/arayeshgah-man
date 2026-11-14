-- ============================================================
-- Rollback for migrations 0002_phone_number_auth + 0003_backfill_phone_numbers.
-- Drizzle has no automatic down migrations; run manually, inside a transaction,
-- AFTER deploying the previous application version and taking a backup:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f drizzle/rollback/0002_0003_phone_auth.down.sql
--
-- Effect: removes the phone login columns from "users". Mobile numbers remain in
-- profiles.phone (they were copied, never moved). Users created by phone sign-up keep
-- their rows (placeholder @phone.arayeshgahman.invalid email).
-- ============================================================

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_phone_number_format";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_phone_number_unique";
ALTER TABLE "users" DROP COLUMN IF EXISTS "phone_number_verified";
ALTER TABLE "users" DROP COLUMN IF EXISTS "phone_number";

-- exactly these two migrations (created_at = "when" in drizzle/meta/_journal.json)
DELETE FROM drizzle."__drizzle_migrations" WHERE created_at IN (1794639006507, 1794639018655);
