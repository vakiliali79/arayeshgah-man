CREATE TYPE "public"."plan_audience" AS ENUM('salon', 'stylist');--> statement-breakpoint
CREATE TYPE "public"."ticket_kind" AS ENUM('contact', 'support', 'complaint', 'review_report');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
ALTER TYPE "public"."membership_status" ADD VALUE IF NOT EXISTS 'requested';--> statement-breakpoint
CREATE TABLE "service_categories" (
	"key" "service_category" PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_categories_label_length" CHECK (char_length("service_categories"."label") between 2 and 60)
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"audience" "plan_audience" NOT NULL,
	"price_monthly_toman" bigint NOT NULL,
	"features" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug"),
	CONSTRAINT "subscription_plans_slug_format" CHECK ("subscription_plans"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "subscription_plans_price" CHECK ("subscription_plans"."price_monthly_toman" between 0 and 1000000000),
	CONSTRAINT "subscription_plans_name_length" CHECK (char_length("subscription_plans"."name") between 2 and 60)
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "ticket_kind" NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"review_id" uuid,
	"salon_id" uuid,
	"booking_id" uuid,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_tickets_name_length" CHECK (char_length("support_tickets"."name") between 2 and 80),
	CONSTRAINT "support_tickets_subject_length" CHECK (char_length("support_tickets"."subject") between 3 and 120),
	CONSTRAINT "support_tickets_message_length" CHECK (char_length("support_tickets"."message") between 10 and 4000),
	CONSTRAINT "support_tickets_phone_format" CHECK ("support_tickets"."phone" is null or "support_tickets"."phone" ~ '^09[0-9]{9}$')
);
--> statement-breakpoint
-- tracking_code: add nullable → backfill existing rows (without touching updated_at) → NOT NULL
ALTER TABLE "bookings" ADD COLUMN "tracking_code" text;--> statement-breakpoint
ALTER TABLE "bookings" DISABLE TRIGGER "bookings_set_updated_at";--> statement-breakpoint
UPDATE "bookings" SET "tracking_code" = 'AM-' || upper(substr(replace("id"::text, '-', ''), 1, 10)) WHERE "tracking_code" IS NULL;--> statement-breakpoint
ALTER TABLE "bookings" ENABLE TRIGGER "bookings_set_updated_at";--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "tracking_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "district" text;--> statement-breakpoint
-- slug: add nullable → backfill existing stylists (without touching updated_at) → NOT NULL
ALTER TABLE "stylists" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "stylists" DISABLE TRIGGER "stylists_set_updated_at";--> statement-breakpoint
UPDATE "stylists" SET "slug" = 'stylist-' || substr(replace("id"::text, '-', ''), 1, 10) WHERE "slug" IS NULL;--> statement-breakpoint
ALTER TABLE "stylists" ENABLE TRIGGER "stylists_set_updated_at";--> statement-breakpoint
ALTER TABLE "stylists" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stylists" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "stylists" ADD COLUMN "district" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "support_tickets_user_idx" ON "support_tickets" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tracking_code_unique" UNIQUE("tracking_code");--> statement-breakpoint
ALTER TABLE "stylists" ADD CONSTRAINT "stylists_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "stylists" ADD CONSTRAINT "stylists_slug_format" CHECK ("stylists"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
-- default display labels for the existing service_category enum (configuration, editable by admins)
INSERT INTO "service_categories" ("key", "label", "sort_order") VALUES
  ('hair', 'کوتاهی و حالت مو', 1),
  ('color', 'رنگ و لایت', 2),
  ('nail', 'کاشت و طراحی ناخن', 3),
  ('skin', 'پاکسازی و مراقبت پوست', 4),
  ('makeup', 'میکاپ و گریم', 5),
  ('brow_lash', 'ابرو و مژه', 6),
  ('spa', 'ماساژ و اسپا', 7),
  ('other', 'سایر خدمات', 8)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
CREATE TRIGGER "support_tickets_set_updated_at" BEFORE UPDATE ON "support_tickets" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "subscription_plans_set_updated_at" BEFORE UPDATE ON "subscription_plans" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER "service_categories_set_updated_at" BEFORE UPDATE ON "service_categories" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
