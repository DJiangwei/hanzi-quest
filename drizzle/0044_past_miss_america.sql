CREATE TABLE "error_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"child_id" uuid,
	"context" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "error_events_time_idx" ON "error_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "error_events_scope_time_idx" ON "error_events" USING btree ("scope","created_at");