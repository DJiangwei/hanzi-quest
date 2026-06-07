ALTER TYPE "public"."shop_item_kind" ADD VALUE 'home';--> statement-breakpoint
CREATE TABLE "home_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"room" text NOT NULL,
	"furniture_slug" text NOT NULL,
	"grid_x" integer NOT NULL,
	"grid_y" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "home_placements" ADD CONSTRAINT "home_placements_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "home_placements_child_furniture_uq" ON "home_placements" USING btree ("child_id","furniture_slug");