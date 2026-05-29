CREATE TYPE "public"."story_tone" AS ENUM('triumphant', 'standard', 'narrow_escape');--> statement-breakpoint
ALTER TYPE "public"."trophy_category" ADD VALUE 'story';--> statement-breakpoint
CREATE TABLE "story_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"week_id" uuid NOT NULL,
	"body_zh" text NOT NULL,
	"body_en" text NOT NULL,
	"summary_for_next" text NOT NULL,
	"tone" "story_tone" NOT NULL,
	"boss_score_pct" integer NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_chapters_boss_score_range" CHECK ("story_chapters"."boss_score_pct" BETWEEN 0 AND 100)
);
--> statement-breakpoint
ALTER TABLE "story_chapters" ADD CONSTRAINT "story_chapters_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_chapters" ADD CONSTRAINT "story_chapters_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "story_chapters_child_week_uq" ON "story_chapters" USING btree ("child_id","week_id");--> statement-breakpoint
CREATE INDEX "story_chapters_child_created_idx" ON "story_chapters" USING btree ("child_id","created_at");