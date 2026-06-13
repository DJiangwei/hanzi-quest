ALTER TYPE "public"."coin_reason" ADD VALUE 'season_reward';--> statement-breakpoint
ALTER TYPE "public"."trophy_category" ADD VALUE 'season';--> statement-breakpoint
CREATE TABLE "child_season_progress" (
	"child_id" uuid NOT NULL,
	"season_id" text NOT NULL,
	"tiers_claimed" integer[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "child_season_progress_child_id_season_id_pk" PRIMARY KEY("child_id","season_id")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" text PRIMARY KEY NOT NULL,
	"name_zh" text NOT NULL,
	"name_en" text NOT NULL,
	"theme_emoji" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"tier_config" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "child_season_progress" ADD CONSTRAINT "child_season_progress_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_season_progress" ADD CONSTRAINT "child_season_progress_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;