-- ============================================================
-- 0001 — Database-level integrity that Drizzle cannot express:
--   * btree_gist + EXCLUSION constraints (no overlapping bookings / shifts)
--   * booking status state machine + immutable booking fields
--   * review ↔ completed booking integrity
--   * updated_at maintenance
-- ============================================================

-- btree_gist is a trusted extension (PG13+): the database owner can create it.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

-- ---------- Bookings: no overlap for the same stylist ----------
-- Only active bookings (pending/confirmed) block time. The blocked interval
-- includes the preparation buffer: [starts_at, blocked_until).
-- Two concurrent transactions inserting overlapping rows: the second one waits
-- for the first to commit, then fails with SQLSTATE 23P01 (exclusion_violation).
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_stylist_overlap"
  EXCLUDE USING gist (
    "stylist_id" WITH =,
    tstzrange("starts_at", "blocked_until", '[)') WITH &&
  ) WHERE ("status" IN ('pending', 'confirmed'));
--> statement-breakpoint

-- A customer cannot hold two active appointments at the same time either.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_customer_overlap"
  EXCLUDE USING gist (
    "customer_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("status" IN ('pending', 'confirmed'));
--> statement-breakpoint

-- ---------- Working hours: no overlapping shifts for the same owner/day ----------
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_no_overlap"
  EXCLUDE USING gist (
    (coalesce("salon_id", '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
    (coalesce("stylist_id", '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
    "day_of_week" WITH =,
    tsrange(date '2000-01-01' + "opens_at", date '2000-01-01' + "closes_at", '[)') WITH &&
  );
--> statement-breakpoint

-- ---------- Time off: GiST indexes for range-overlap lookups ----------
CREATE INDEX "working_time_off_stylist_range_gist" ON "working_time_off"
  USING gist ("stylist_id", tstzrange("starts_at", "ends_at", '[)'));
--> statement-breakpoint
CREATE INDEX "working_time_off_salon_range_gist" ON "working_time_off"
  USING gist ("salon_id", tstzrange("starts_at", "ends_at", '[)'));
--> statement-breakpoint

-- ---------- Booking state machine (defense in depth; the app enforces it too) ----------
CREATE OR REPLACE FUNCTION "bookings_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('pending', 'confirmed') THEN
      RAISE EXCEPTION 'new bookings must start as pending or confirmed (got %)', NEW.status
        USING ERRCODE = 'check_violation', CONSTRAINT = 'bookings_status_transition';
    END IF;
    RETURN NEW;
  END IF;

  -- Commercial/identity fields are immutable after creation.
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.stylist_id IS DISTINCT FROM OLD.stylist_id
     OR NEW.salon_id IS DISTINCT FROM OLD.salon_id
     OR NEW.service_id IS DISTINCT FROM OLD.service_id
     OR NEW.price_toman IS DISTINCT FROM OLD.price_toman THEN
    RAISE EXCEPTION 'booking participants, service and price are immutable'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'bookings_immutable_fields';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'pending'   AND NEW.status IN ('confirmed', 'rejected', 'cancelled'))
    OR (OLD.status = 'confirmed' AND NEW.status IN ('completed', 'cancelled', 'no_show'))
  ) THEN
    RAISE EXCEPTION 'invalid booking status transition % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation', CONSTRAINT = 'bookings_status_transition';
  END IF;

  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "bookings_guard_trg"
  BEFORE INSERT OR UPDATE ON "bookings"
  FOR EACH ROW EXECUTE FUNCTION "bookings_guard"();
--> statement-breakpoint

-- ---------- Reviews must belong to a completed booking of the same customer ----------
CREATE OR REPLACE FUNCTION "reviews_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  b record;
BEGIN
  SELECT status, customer_id, stylist_id, salon_id INTO b
  FROM bookings WHERE id = NEW.booking_id;

  IF NOT FOUND OR b.status <> 'completed' THEN
    RAISE EXCEPTION 'reviews are only allowed for completed bookings'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'reviews_booking_completed';
  END IF;
  IF b.customer_id <> NEW.customer_id
     OR b.stylist_id <> NEW.stylist_id
     OR b.salon_id IS DISTINCT FROM NEW.salon_id THEN
    RAISE EXCEPTION 'review must match the booking customer, stylist and salon'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'reviews_booking_match';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "reviews_guard_trg"
  BEFORE INSERT OR UPDATE OF "booking_id", "customer_id", "stylist_id", "salon_id" ON "reviews"
  FOR EACH ROW EXECUTE FUNCTION "reviews_guard"();
--> statement-breakpoint

-- ---------- updated_at (application tables only; Better Auth manages its own) ----------
CREATE OR REPLACE FUNCTION "set_updated_at"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'salons', 'salon_members', 'stylists', 'services', 'stylist_services',
    'working_hours', 'working_time_off', 'bookings', 'reviews', 'portfolio_items'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t || '_set_updated_at', t
    );
  END LOOP;
END $$;
