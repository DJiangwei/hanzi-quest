DROP INDEX "homework_items_week_idx";--> statement-breakpoint
ALTER TABLE "homework_items" ADD COLUMN "child_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "homework_items" ADD CONSTRAINT "homework_items_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "homework_items_child_week_idx" ON "homework_items" USING btree ("child_id","week_id");