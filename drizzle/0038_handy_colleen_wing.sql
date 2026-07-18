ALTER TYPE "public"."coin_reason" ADD VALUE 'bounty_claim';--> statement-breakpoint
CREATE TABLE "bounty_posters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"day_utc" text NOT NULL,
	"character_id" uuid NOT NULL,
	"required" integer NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bounty_posters" ADD CONSTRAINT "bounty_posters_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_posters" ADD CONSTRAINT "bounty_posters_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bounty_posters_child_day_char_uq" ON "bounty_posters" USING btree ("child_id","day_utc","character_id");