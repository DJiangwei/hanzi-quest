CREATE TABLE "card_grants_log" (
	"child_id" uuid NOT NULL,
	"source" text NOT NULL,
	"ref_id" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_grants_log_child_id_source_ref_id_pk" PRIMARY KEY("child_id","source","ref_id")
);
--> statement-breakpoint
CREATE TABLE "child_card_grants_weekly" (
	"child_id" uuid NOT NULL,
	"week_start_utc" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "child_card_grants_weekly_child_id_week_start_utc_pk" PRIMARY KEY("child_id","week_start_utc")
);
--> statement-breakpoint
ALTER TABLE "card_grants_log" ADD CONSTRAINT "card_grants_log_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_card_grants_weekly" ADD CONSTRAINT "child_card_grants_weekly_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;