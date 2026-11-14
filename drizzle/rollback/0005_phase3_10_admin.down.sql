-- Rollback for 0005_phase3_10_admin. Run manually inside a transaction AFTER deploying the
-- previous application version and taking a backup:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f drizzle/rollback/0005_phase3_10_admin.down.sql
-- Data loss on rollback (by design): admin audit log, ticket reply history, suspension/rejection/hidden reasons.
-- Services whose category was added after 0005 cannot be represented by the old enum: they are moved to 'other'.
DROP TRIGGER IF EXISTS admin_audit_logs_append_only ON "admin_audit_logs";
DROP FUNCTION IF EXISTS admin_audit_logs_append_only();
DROP TABLE IF EXISTS "admin_audit_logs";
DROP TABLE IF EXISTS "support_ticket_messages";
DROP TYPE IF EXISTS "ticket_message_kind";

ALTER TABLE "profiles" DROP CONSTRAINT IF EXISTS "profiles_suspended_reason_length";
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "status";
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "suspended_at";
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "suspended_reason";
DROP TYPE IF EXISTS "account_status";
ALTER TABLE "reviews" DROP COLUMN IF EXISTS "hidden_reason";
ALTER TABLE "salons" DROP COLUMN IF EXISTS "rejection_reason";
ALTER TABLE "salons" DROP COLUMN IF EXISTS "reviewed_at";

-- categories: text -> enum service_category
ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "services_category_service_categories_key_fk";
ALTER TABLE "service_categories" DROP CONSTRAINT IF EXISTS "service_categories_key_format";
CREATE TYPE "public"."service_category" AS ENUM('hair', 'color', 'nail', 'skin', 'makeup', 'brow_lash', 'spa', 'other');
UPDATE "services" SET "category" = 'other'
  WHERE "category" NOT IN ('hair', 'color', 'nail', 'skin', 'makeup', 'brow_lash', 'spa', 'other');
DELETE FROM "service_categories"
  WHERE "key" NOT IN ('hair', 'color', 'nail', 'skin', 'makeup', 'brow_lash', 'spa', 'other');
ALTER TABLE "services" ALTER COLUMN "category" SET DATA TYPE "service_category" USING "category"::"service_category";
ALTER TABLE "service_categories" ALTER COLUMN "key" SET DATA TYPE "service_category" USING "key"::"service_category";

DELETE FROM drizzle."__drizzle_migrations" WHERE created_at = 1794651559271;
