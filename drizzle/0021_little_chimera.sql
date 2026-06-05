CREATE TABLE "child_card_grants_daily" (
	"child_id" uuid NOT NULL,
	"day_utc" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "child_card_grants_daily_child_id_day_utc_pk" PRIMARY KEY("child_id","day_utc")
);
--> statement-breakpoint
ALTER TABLE "child_card_grants_daily" ADD CONSTRAINT "child_card_grants_daily_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;