ALTER TYPE "public"."shop_item_kind" ADD VALUE 'pet';--> statement-breakpoint
CREATE TABLE "child_pet_equipped" (
	"child_id" uuid PRIMARY KEY NOT NULL,
	"pet_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_zh" text NOT NULL,
	"name_en" text NOT NULL,
	"emoji" text NOT NULL,
	"description_zh" text,
	"description_en" text,
	"speech_zh" text[] NOT NULL,
	"speech_en" text[] NOT NULL,
	"display_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pets_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "child_pet_equipped" ADD CONSTRAINT "child_pet_equipped_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_pet_equipped" ADD CONSTRAINT "child_pet_equipped_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pets_display_order_idx" ON "pets" USING btree ("display_order");