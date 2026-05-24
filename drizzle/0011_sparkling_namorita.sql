ALTER TABLE "week_levels" ADD COLUMN "level_key" text;--> statement-breakpoint
UPDATE "week_levels" SET "level_key" = "week_id"::text || ':' || "position"::text WHERE "level_key" IS NULL;--> statement-breakpoint
ALTER TABLE "week_levels" ALTER COLUMN "level_key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "week_levels_week_level_key_unique" ON "week_levels" USING btree ("week_id","level_key");
