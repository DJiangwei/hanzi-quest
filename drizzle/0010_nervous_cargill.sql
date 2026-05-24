ALTER TYPE "public"."shop_item_kind" ADD VALUE 'decor';--> statement-breakpoint
CREATE TABLE "decorations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_zh" text NOT NULL,
	"name_en" text NOT NULL,
	"description_zh" text,
	"description_en" text,
	"emoji" text NOT NULL,
	"anchor_slug" text NOT NULL,
	"display_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decorations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "decorations_display_order_idx" ON "decorations" USING btree ("display_order");