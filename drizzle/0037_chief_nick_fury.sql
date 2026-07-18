DROP INDEX "home_placements_child_furniture_uq";--> statement-breakpoint
ALTER TABLE "home_placements" ADD COLUMN "copy_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "home_placements_child_furniture_copy_uq" ON "home_placements" USING btree ("child_id","furniture_slug","copy_index");