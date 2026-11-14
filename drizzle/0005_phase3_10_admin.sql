CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."ticket_message_kind" AS ENUM('reply', 'note', 'status');--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"summary" text,
	"reason" text,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_audit_logs_action_format" CHECK ("admin_audit_logs"."action" ~ '^[a-z_]+\.[a-z_]+$'),
	CONSTRAINT "admin_audit_logs_reason_length" CHECK ("admin_audit_logs"."reason" is null or char_length("admin_audit_logs"."reason") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "support_ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_id" uuid,
	"kind" "ticket_message_kind" NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_ticket_messages_body_length" CHECK (char_length("support_ticket_messages"."body") between 1 and 4000)
);
--> statement-breakpoint
-- service categories: enum -> text key + foreign key, so admins can add categories without DDL (values unchanged)
ALTER TABLE "service_categories" ALTER COLUMN "key" SET DATA TYPE text USING "key"::text;--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "category" SET DATA TYPE text USING "category"::text;--> statement-breakpoint
-- defensive: every category already used by a service must exist before the foreign key is added
INSERT INTO "service_categories" ("key", "label", "sort_order") SELECT DISTINCT "category", "category", 999 FROM "services" ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "status" "account_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "hidden_reason" text;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_logs_target_idx" ON "admin_audit_logs" USING btree ("target_type","target_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "admin_audit_logs_created_idx" ON "admin_audit_logs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "support_ticket_messages_ticket_idx" ON "support_ticket_messages" USING btree ("ticket_id","created_at");--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_category_service_categories_key_fk" FOREIGN KEY ("category") REFERENCES "public"."service_categories"("key") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_key_format" CHECK ("service_categories"."key" ~ '^[a-z][a-z0-9_]{1,31}$');--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_suspended_reason_length" CHECK ("profiles"."suspended_reason" is null or char_length("profiles"."suspended_reason") between 3 and 500);;--> statement-breakpoint
DROP TYPE "public"."service_category";--> statement-breakpoint
-- admin audit log is append-only: no deletes, no edits (except actor_id -> NULL from ON DELETE SET NULL)
CREATE FUNCTION admin_audit_logs_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'admin_audit_logs is append-only' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.actor_id IS NOT NULL OR (to_jsonb(NEW) - 'actor_id') IS DISTINCT FROM (to_jsonb(OLD) - 'actor_id') THEN
    RAISE EXCEPTION 'admin_audit_logs is append-only' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER admin_audit_logs_append_only BEFORE UPDATE OR DELETE ON "admin_audit_logs"
  FOR EACH ROW EXECUTE FUNCTION admin_audit_logs_append_only();
