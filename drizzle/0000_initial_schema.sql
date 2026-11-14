CREATE TYPE "public"."booking_actor" AS ENUM('customer', 'stylist', 'salon', 'admin', 'system');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'completed', 'cancelled', 'rejected', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."file_purpose" AS ENUM('avatar', 'salon_cover', 'salon_gallery', 'portfolio');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('invited', 'active', 'suspended', 'left');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('booking_created', 'booking_confirmed', 'booking_rejected', 'booking_cancelled', 'booking_completed', 'booking_reminder', 'review_received', 'membership_invited', 'membership_updated', 'system');--> statement-breakpoint
CREATE TYPE "public"."salon_member_role" AS ENUM('owner', 'manager', 'stylist', 'receptionist');--> statement-breakpoint
CREATE TYPE "public"."salon_permission" AS ENUM('manage_salon', 'manage_members', 'manage_services', 'manage_schedule', 'manage_bookings', 'manage_portfolio', 'view_reports');--> statement-breakpoint
CREATE TYPE "public"."service_category" AS ENUM('hair', 'color', 'nail', 'skin', 'makeup', 'brow_lash', 'spa', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'stylist', 'salon_owner', 'admin');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"from_status" "booking_status",
	"to_status" "booking_status" NOT NULL,
	"actor_type" "booking_actor" NOT NULL,
	"actor_user_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"stylist_id" uuid NOT NULL,
	"salon_id" uuid,
	"service_id" uuid NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"blocked_until" timestamp with time zone NOT NULL,
	"service_name" text NOT NULL,
	"duration_minutes" smallint NOT NULL,
	"buffer_minutes" smallint DEFAULT 0 NOT NULL,
	"price_toman" bigint NOT NULL,
	"timezone" text NOT NULL,
	"customer_note" text,
	"cancellation_reason" text,
	"cancelled_by" "booking_actor",
	"confirmed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_time_order" CHECK ("bookings"."ends_at" > "bookings"."starts_at" and "bookings"."blocked_until" >= "bookings"."ends_at"),
	CONSTRAINT "bookings_duration_matches" CHECK ("bookings"."ends_at" - "bookings"."starts_at" = make_interval(mins => "bookings"."duration_minutes"::int)
        and "bookings"."blocked_until" - "bookings"."ends_at" = make_interval(mins => "bookings"."buffer_minutes"::int)),
	CONSTRAINT "bookings_price_non_negative" CHECK ("bookings"."price_toman" >= 0),
	CONSTRAINT "bookings_note_length" CHECK ("bookings"."customer_note" is null or char_length("bookings"."customer_note") <= 500),
	CONSTRAINT "bookings_status_timestamps" CHECK (("bookings"."status" <> 'cancelled' or "bookings"."cancelled_at" is not null)
        and ("bookings"."status" <> 'rejected' or "bookings"."rejected_at" is not null)
        and ("bookings"."status" <> 'completed' or "bookings"."completed_at" is not null)
        and ("bookings"."status" <> 'confirmed' or "bookings"."confirmed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"salon_id" uuid,
	"stylist_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_single_target" CHECK (num_nonnulls("favorites"."salon_id", "favorites"."stylist_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"purpose" "file_purpose" NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" text,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" text NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "files_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "files_size_positive" CHECK ("files"."size_bytes" > 0),
	CONSTRAINT "files_mime_allowed" CHECK ("files"."mime_type" in ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "files_storage_key_safe" CHECK ("files"."storage_key" !~ '(^/|\.\.)'),
	CONSTRAINT "files_sha256_format" CHECK ("files"."sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_title_length" CHECK (char_length("notifications"."title") between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "portfolio_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stylist_id" uuid,
	"salon_id" uuid,
	"service_id" uuid,
	"file_id" uuid NOT NULL,
	"title" text,
	"description" text,
	"is_published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_items_file_id_unique" UNIQUE("file_id"),
	CONSTRAINT "portfolio_has_owner" CHECK (num_nonnulls("portfolio_items"."stylist_id", "portfolio_items"."salon_id") >= 1),
	CONSTRAINT "portfolio_title_length" CHECK ("portfolio_items"."title" is null or char_length("portfolio_items"."title") <= 120)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"role_selected_at" timestamp with time zone,
	"full_name" text,
	"phone" text,
	"city" text,
	"avatar_file_id" uuid,
	"timezone" text DEFAULT 'Asia/Tehran' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_phone_unique" UNIQUE("phone"),
	CONSTRAINT "profiles_phone_format" CHECK ("profiles"."phone" is null or "profiles"."phone" ~ '^09[0-9]{9}$'),
	CONSTRAINT "profiles_full_name_length" CHECK ("profiles"."full_name" is null or char_length("profiles"."full_name") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"stylist_id" uuid NOT NULL,
	"salon_id" uuid,
	"rating" smallint NOT NULL,
	"comment" text,
	"reply" text,
	"replied_at" timestamp with time zone,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_booking_id_unique" UNIQUE("booking_id"),
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" between 1 and 5),
	CONSTRAINT "reviews_comment_length" CHECK ("reviews"."comment" is null or char_length("reviews"."comment") <= 2000),
	CONSTRAINT "reviews_reply_length" CHECK ("reviews"."reply" is null or char_length("reviews"."reply") <= 2000)
);
--> statement-breakpoint
CREATE TABLE "salon_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "salon_member_role" NOT NULL,
	"status" "membership_status" DEFAULT 'invited' NOT NULL,
	"permissions" "salon_permission"[] DEFAULT '{}'::salon_permission[] NOT NULL,
	"invited_by" uuid,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"phone" text,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"timezone" text DEFAULT 'Asia/Tehran' NOT NULL,
	"cover_file_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"rating_avg" numeric(3, 2) DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "salons_slug_unique" UNIQUE("slug"),
	CONSTRAINT "salons_slug_format" CHECK ("salons"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "salons_name_length" CHECK (char_length("salons"."name") between 2 and 120),
	CONSTRAINT "salons_rating_range" CHECK ("salons"."rating_avg" between 0 and 5 and "salons"."rating_count" >= 0),
	CONSTRAINT "salons_phone_format" CHECK ("salons"."phone" is null or "salons"."phone" ~ '^0[0-9]{10}$')
);
--> statement-breakpoint
CREATE TABLE "working_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid,
	"stylist_id" uuid,
	"day_of_week" smallint NOT NULL,
	"opens_at" time NOT NULL,
	"closes_at" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "working_hours_has_owner" CHECK (num_nonnulls("working_hours"."salon_id", "working_hours"."stylist_id") >= 1),
	CONSTRAINT "working_hours_day_range" CHECK ("working_hours"."day_of_week" between 0 and 6),
	CONSTRAINT "working_hours_order" CHECK ("working_hours"."closes_at" > "working_hours"."opens_at")
);
--> statement-breakpoint
CREATE TABLE "working_time_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid,
	"stylist_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "working_time_off_has_owner" CHECK (num_nonnulls("working_time_off"."salon_id", "working_time_off"."stylist_id") >= 1),
	CONSTRAINT "working_time_off_order" CHECK ("working_time_off"."ends_at" > "working_time_off"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid,
	"stylist_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"category" "service_category" NOT NULL,
	"duration_minutes" smallint NOT NULL,
	"buffer_minutes" smallint DEFAULT 0 NOT NULL,
	"price_toman" bigint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_single_owner" CHECK (num_nonnulls("services"."salon_id", "services"."stylist_id") = 1),
	CONSTRAINT "services_duration_range" CHECK ("services"."duration_minutes" between 5 and 720 and "services"."duration_minutes" % 5 = 0),
	CONSTRAINT "services_buffer_range" CHECK ("services"."buffer_minutes" between 0 and 120),
	CONSTRAINT "services_price_range" CHECK ("services"."price_toman" >= 0 and "services"."price_toman" <= 1000000000),
	CONSTRAINT "services_name_length" CHECK (char_length("services"."name") between 2 and 120)
);
--> statement-breakpoint
CREATE TABLE "stylist_services" (
	"stylist_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"custom_price_toman" bigint,
	"custom_duration_minutes" smallint,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stylist_services_stylist_id_service_id_pk" PRIMARY KEY("stylist_id","service_id"),
	CONSTRAINT "stylist_services_price_range" CHECK ("stylist_services"."custom_price_toman" is null or "stylist_services"."custom_price_toman" between 0 and 1000000000),
	CONSTRAINT "stylist_services_duration_range" CHECK ("stylist_services"."custom_duration_minutes" is null or ("stylist_services"."custom_duration_minutes" between 5 and 720 and "stylist_services"."custom_duration_minutes" % 5 = 0))
);
--> statement-breakpoint
CREATE TABLE "stylists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"specialties" text[] DEFAULT '{}'::text[] NOT NULL,
	"years_experience" smallint,
	"accepts_independent_bookings" boolean DEFAULT false NOT NULL,
	"timezone" text DEFAULT 'Asia/Tehran' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"rating_avg" numeric(3, 2) DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stylists_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "stylists_display_name_length" CHECK (char_length("stylists"."display_name") between 2 and 80),
	CONSTRAINT "stylists_experience_range" CHECK ("stylists"."years_experience" is null or "stylists"."years_experience" between 0 and 70),
	CONSTRAINT "stylists_rating_range" CHECK ("stylists"."rating_avg" between 0 and 5 and "stylists"."rating_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_stylist_id_stylists_id_fk" FOREIGN KEY ("stylist_id") REFERENCES "public"."stylists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_stylist_id_stylists_id_fk" FOREIGN KEY ("stylist_id") REFERENCES "public"."stylists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_stylist_id_stylists_id_fk" FOREIGN KEY ("stylist_id") REFERENCES "public"."stylists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_avatar_file_id_files_id_fk" FOREIGN KEY ("avatar_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_stylist_id_stylists_id_fk" FOREIGN KEY ("stylist_id") REFERENCES "public"."stylists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon_members" ADD CONSTRAINT "salon_members_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon_members" ADD CONSTRAINT "salon_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon_members" ADD CONSTRAINT "salon_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salons" ADD CONSTRAINT "salons_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salons" ADD CONSTRAINT "salons_cover_file_id_files_id_fk" FOREIGN KEY ("cover_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_stylist_id_stylists_id_fk" FOREIGN KEY ("stylist_id") REFERENCES "public"."stylists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_time_off" ADD CONSTRAINT "working_time_off_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_time_off" ADD CONSTRAINT "working_time_off_stylist_id_stylists_id_fk" FOREIGN KEY ("stylist_id") REFERENCES "public"."stylists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_time_off" ADD CONSTRAINT "working_time_off_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_stylist_id_stylists_id_fk" FOREIGN KEY ("stylist_id") REFERENCES "public"."stylists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylist_services" ADD CONSTRAINT "stylist_services_stylist_id_stylists_id_fk" FOREIGN KEY ("stylist_id") REFERENCES "public"."stylists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylist_services" ADD CONSTRAINT "stylist_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylists" ADD CONSTRAINT "stylists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "booking_events_booking_idx" ON "booking_events" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "bookings_customer_starts_idx" ON "bookings" USING btree ("customer_id","starts_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "bookings_stylist_starts_idx" ON "bookings" USING btree ("stylist_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_salon_starts_idx" ON "bookings" USING btree ("salon_id","starts_at") WHERE "bookings"."salon_id" is not null;--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_customer_salon_uq" ON "favorites" USING btree ("customer_id","salon_id") WHERE "favorites"."salon_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_customer_stylist_uq" ON "favorites" USING btree ("customer_id","stylist_id") WHERE "favorites"."stylist_id" is not null;--> statement-breakpoint
CREATE INDEX "files_owner_idx" ON "files" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "portfolio_stylist_idx" ON "portfolio_items" USING btree ("stylist_id","sort_order");--> statement-breakpoint
CREATE INDEX "portfolio_salon_idx" ON "portfolio_items" USING btree ("salon_id","sort_order");--> statement-breakpoint
CREATE INDEX "profiles_role_idx" ON "profiles" USING btree ("role");--> statement-breakpoint
CREATE INDEX "reviews_stylist_idx" ON "reviews" USING btree ("stylist_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reviews_salon_idx" ON "reviews" USING btree ("salon_id","created_at" DESC NULLS LAST) WHERE "reviews"."salon_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "salon_members_salon_user_uq" ON "salon_members" USING btree ("salon_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "salon_members_one_owner_uq" ON "salon_members" USING btree ("salon_id") WHERE "salon_members"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "salon_members_user_idx" ON "salon_members" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "salons_owner_idx" ON "salons" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "salons_city_active_idx" ON "salons" USING btree ("city","is_active");--> statement-breakpoint
CREATE INDEX "working_hours_salon_idx" ON "working_hours" USING btree ("salon_id","day_of_week");--> statement-breakpoint
CREATE INDEX "working_hours_stylist_idx" ON "working_hours" USING btree ("stylist_id","day_of_week");--> statement-breakpoint
CREATE INDEX "working_time_off_salon_period_idx" ON "working_time_off" USING btree ("salon_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "working_time_off_stylist_period_idx" ON "working_time_off" USING btree ("stylist_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "services_salon_idx" ON "services" USING btree ("salon_id") WHERE "services"."salon_id" is not null;--> statement-breakpoint
CREATE INDEX "services_stylist_idx" ON "services" USING btree ("stylist_id") WHERE "services"."stylist_id" is not null;--> statement-breakpoint
CREATE INDEX "stylist_services_service_idx" ON "stylist_services" USING btree ("service_id");