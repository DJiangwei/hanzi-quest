CREATE TABLE "piggy_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"delta_pence" integer NOT NULL,
	"source" text NOT NULL,
	"category" text,
	"note" text,
	"ref_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "child_profiles" ADD COLUMN "piggy_bank_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "piggy_entries" ADD CONSTRAINT "piggy_entries_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "piggy_entries_child_idx" ON "piggy_entries" USING btree ("child_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "piggy_entries_auto_uq" ON "piggy_entries" USING btree ("child_id","source","ref_id") WHERE "piggy_entries"."ref_id" is not null;