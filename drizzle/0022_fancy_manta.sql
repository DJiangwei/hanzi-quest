ALTER TYPE "public"."coin_reason" ADD VALUE 'daily_chest';--> statement-breakpoint
CREATE TABLE "child_xp" (
	"child_id" uuid PRIMARY KEY NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"source" text NOT NULL,
	"ref_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_quest_chests" (
	"child_id" uuid NOT NULL,
	"date" text NOT NULL,
	"coins" integer NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_quest_chests_child_id_date_pk" PRIMARY KEY("child_id","date")
);
--> statement-breakpoint
CREATE TABLE "daily_quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"date" text NOT NULL,
	"quest_id" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"target" integer NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "child_xp" ADD CONSTRAINT "child_xp_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_quest_chests" ADD CONSTRAINT "daily_quest_chests_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_quests" ADD CONSTRAINT "daily_quests_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_quests_child_date_quest_uq" ON "daily_quests" USING btree ("child_id","date","quest_id");