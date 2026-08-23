CREATE TABLE "card_gifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_child_id" uuid NOT NULL,
	"to_child_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"day_utc" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seen_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "card_gifts" ADD CONSTRAINT "card_gifts_from_child_id_child_profiles_id_fk" FOREIGN KEY ("from_child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_gifts" ADD CONSTRAINT "card_gifts_to_child_id_child_profiles_id_fk" FOREIGN KEY ("to_child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_gifts" ADD CONSTRAINT "card_gifts_item_id_collectible_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."collectible_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_gifts_to_unseen_idx" ON "card_gifts" USING btree ("to_child_id","seen_at");--> statement-breakpoint
CREATE INDEX "card_gifts_from_day_idx" ON "card_gifts" USING btree ("from_child_id","day_utc");--> statement-breakpoint
CREATE INDEX "card_gifts_to_day_idx" ON "card_gifts" USING btree ("to_child_id","day_utc");