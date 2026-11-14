-- ============================================================
-- 0003 — Phone-number authentication: data backfill + format guard
-- Non-destructive: no rows or columns are deleted; existing emails are kept.
-- Rollback: drizzle/rollback/0002_0003_phone_auth.down.sql
-- ============================================================

-- Existing users keep access: copy their mobile number (profiles.phone, 09XXXXXXXXX)
-- into the Better Auth login identifier in canonical E.164 form (+989XXXXXXXXX).
-- Not marked verified: the first successful OTP login verifies it.
UPDATE "users" u
SET "phone_number" = '+98' || substr(p."phone", 2),
    "phone_number_verified" = false
FROM "profiles" p
WHERE p."user_id" = u."id"
  AND p."phone" IS NOT NULL
  AND u."phone_number" IS NULL;
--> statement-breakpoint

-- Only the canonical form may be stored (prevents duplicates in different formats).
ALTER TABLE "users" ADD CONSTRAINT "users_phone_number_format"
  CHECK ("phone_number" IS NULL OR "phone_number" ~ '^\+989[0-9]{9}$');
