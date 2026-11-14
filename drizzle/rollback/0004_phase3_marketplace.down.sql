-- Rollback for 0004_phase3_marketplace. Run manually inside a transaction AFTER deploying the
-- previous application version and taking a backup:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f drizzle/rollback/0004_phase3_marketplace.down.sql
-- Note: the 'requested' value cannot be removed from enum membership_status; such rows are set to 'left'.
DROP TABLE IF EXISTS "support_tickets";
DROP TABLE IF EXISTS "subscription_plans";
DROP TABLE IF EXISTS "site_settings";
DROP TABLE IF EXISTS "service_categories";
DROP TYPE IF EXISTS "ticket_kind";
DROP TYPE IF EXISTS "ticket_status";
DROP TYPE IF EXISTS "plan_audience";
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_tracking_code_unique";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "tracking_code";
ALTER TABLE "salons" DROP COLUMN IF EXISTS "district";
ALTER TABLE "stylists" DROP CONSTRAINT IF EXISTS "stylists_slug_format";
ALTER TABLE "stylists" DROP CONSTRAINT IF EXISTS "stylists_slug_unique";
ALTER TABLE "stylists" DROP COLUMN IF EXISTS "slug";
ALTER TABLE "stylists" DROP COLUMN IF EXISTS "city";
ALTER TABLE "stylists" DROP COLUMN IF EXISTS "district";
UPDATE "salon_members" SET "status" = 'left' WHERE "status" = 'requested';
DELETE FROM drizzle."__drizzle_migrations" WHERE created_at = 1794643178010;
