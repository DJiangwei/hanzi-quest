ALTER TYPE "public"."shop_item_kind" ADD VALUE 'sound_theme';--> statement-breakpoint
CREATE TABLE "child_settings" (
	"child_id" uuid PRIMARY KEY NOT NULL,
	"sound_theme_slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "child_settings" ADD CONSTRAINT "child_settings_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;