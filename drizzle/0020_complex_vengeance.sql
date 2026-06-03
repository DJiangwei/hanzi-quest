ALTER TABLE "avatar_items" ADD COLUMN "theme" text;--> statement-breakpoint
CREATE INDEX "avatar_items_theme_idx" ON "avatar_items" USING btree ("theme");