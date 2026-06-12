CREATE TYPE "public"."homework_item_type" AS ENUM('char_quiz', 'word_building', 'sentence_order');--> statement-breakpoint
ALTER TYPE "public"."coin_reason" ADD VALUE 'homework_complete';--> statement-breakpoint
CREATE TABLE "homework_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"type" "homework_item_type" NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "homework_items" ADD CONSTRAINT "homework_items_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "homework_items_week_idx" ON "homework_items" USING btree ("week_id");