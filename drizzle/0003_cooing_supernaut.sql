ALTER TABLE "weeks" ALTER COLUMN "parent_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "weeks" ALTER COLUMN "child_id" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "weeks_pack_idx" ON "weeks" USING btree ("curriculum_pack_id");--> statement-breakpoint
CREATE UNIQUE INDEX "weeks_pack_week_unique" ON "weeks" USING btree ("curriculum_pack_id","week_number") WHERE "weeks"."child_id" IS NULL;