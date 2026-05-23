CREATE TYPE "public"."trophy_category" AS ENUM('mastery', 'streak', 'collection', 'coins', 'practice');--> statement-breakpoint
CREATE TABLE "child_trophies" (
	"child_id" uuid NOT NULL,
	"trophy_id" uuid NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "child_trophies_child_id_trophy_id_pk" PRIMARY KEY("child_id","trophy_id")
);
--> statement-breakpoint
CREATE TABLE "trophies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_zh" text NOT NULL,
	"name_en" text NOT NULL,
	"description_zh" text NOT NULL,
	"description_en" text NOT NULL,
	"lore_zh" text,
	"lore_en" text,
	"emoji" text NOT NULL,
	"category" "trophy_category" NOT NULL,
	"display_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trophies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "child_trophies" ADD CONSTRAINT "child_trophies_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_trophies" ADD CONSTRAINT "child_trophies_trophy_id_trophies_id_fk" FOREIGN KEY ("trophy_id") REFERENCES "public"."trophies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "child_trophies_child_idx" ON "child_trophies" USING btree ("child_id","earned_at");--> statement-breakpoint
CREATE INDEX "trophies_category_idx" ON "trophies" USING btree ("category","display_order");