CREATE TYPE "public"."user_role" AS ENUM('parent', 'admin');--> statement-breakpoint
CREATE TYPE "public"."character_source" AS ENUM('curated', 'school', 'ai_generated');--> statement-breakpoint
CREATE TYPE "public"."script_kind" AS ENUM('simplified', 'traditional');--> statement-breakpoint
CREATE TYPE "public"."week_status" AS ENUM('draft', 'ai_generating', 'awaiting_review', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."scene_type" AS ENUM('flashcard', 'audio_pick', 'visual_pick', 'image_pick', 'word_match', 'tracing', 'boss');--> statement-breakpoint
CREATE TYPE "public"."coin_reason" AS ENUM('scene_complete', 'scene_replay', 'scene_perfect_bonus', 'boss_clear', 'streak_daily', 'shop_purchase', 'gacha_pull', 'shard_redeem', 'admin_adjust');--> statement-breakpoint
CREATE TYPE "public"."shop_item_kind" AS ENUM('avatar', 'powerup', 'consumable', 'pack_voucher');--> statement-breakpoint
CREATE TYPE "public"."rarity" AS ENUM('common', 'rare', 'epic');--> statement-breakpoint
CREATE TYPE "public"."avatar_unlock_via" AS ENUM('default', 'shop', 'collection', 'achievement');--> statement-breakpoint
CREATE TYPE "public"."powerup_kind" AS ENUM('revive', 'hint', 'streak_freeze');--> statement-breakpoint
CREATE TYPE "public"."ai_job_kind" AS ENUM('generate_week', 'regenerate_char', 'generate_sentence');--> statement-breakpoint
CREATE TYPE "public"."ai_job_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "child_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"birth_year" smallint,
	"current_curriculum_pack_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"role" "user_role" DEFAULT 'parent' NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "character_sentence" (
	"character_id" uuid NOT NULL,
	"sentence_id" uuid NOT NULL,
	CONSTRAINT "character_sentence_character_id_sentence_id_pk" PRIMARY KEY("character_id","sentence_id")
);
--> statement-breakpoint
CREATE TABLE "character_word" (
	"character_id" uuid NOT NULL,
	"word_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "character_word_character_id_word_id_pk" PRIMARY KEY("character_id","word_id")
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hanzi" text NOT NULL,
	"script" "script_kind" DEFAULT 'simplified' NOT NULL,
	"pinyin_array" text[] NOT NULL,
	"meaning_en" text,
	"meaning_zh" text,
	"stroke_count" smallint,
	"frequency_rank" integer,
	"image_url" text,
	"audio_url" text,
	"source" character_source DEFAULT 'ai_generated' NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curriculum_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"owner_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "example_sentences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"pinyin_array" text[] NOT NULL,
	"meaning_en" text,
	"audio_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "week_characters" (
	"week_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"parent_notes" text,
	CONSTRAINT "week_characters_week_id_character_id_pk" PRIMARY KEY("week_id","character_id")
);
--> statement-breakpoint
CREATE TABLE "weeks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_user_id" text NOT NULL,
	"child_id" uuid NOT NULL,
	"curriculum_pack_id" uuid NOT NULL,
	"week_number" integer NOT NULL,
	"label" text NOT NULL,
	"status" "week_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"script" "script_kind" DEFAULT 'simplified' NOT NULL,
	"pinyin_array" text[] NOT NULL,
	"meaning_en" text,
	"audio_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "play_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"device" text,
	"session_summary" jsonb
);
--> statement-breakpoint
CREATE TABLE "scene_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"week_level_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"hints_used" integer DEFAULT 0 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"coins_awarded" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scene_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "scene_type" NOT NULL,
	"version" smallint DEFAULT 1 NOT NULL,
	"default_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streaks" (
	"child_id" uuid PRIMARY KEY NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_played_date" date,
	"freeze_tokens" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "week_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"scene_template_id" uuid NOT NULL,
	"scene_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"unlocked_after_position" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "week_progress" (
	"child_id" uuid NOT NULL,
	"week_id" uuid NOT NULL,
	"completion_percent" smallint DEFAULT 0 NOT NULL,
	"boss_cleared" boolean DEFAULT false NOT NULL,
	"last_played_at" timestamp with time zone,
	"total_time_seconds" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "week_progress_child_id_week_id_pk" PRIMARY KEY("child_id","week_id")
);
--> statement-breakpoint
CREATE TABLE "coin_balances" (
	"child_id" uuid PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"lifetime_earned" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coin_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" "coin_reason" NOT NULL,
	"ref_type" text,
	"ref_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gacha_pulls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"pack_id" uuid NOT NULL,
	"cost_coins" integer DEFAULT 0 NOT NULL,
	"is_free" boolean DEFAULT false NOT NULL,
	"result_item_id" uuid NOT NULL,
	"was_duplicate" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"kind" "shop_item_kind" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"price_coins" integer NOT NULL,
	"available_from" timestamp with time zone,
	"available_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_items_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "shop_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"shop_item_id" uuid NOT NULL,
	"coins_spent" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "child_collections" (
	"child_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"first_obtained_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "child_collections_child_id_item_id_pk" PRIMARY KEY("child_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "collectible_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name_zh" text NOT NULL,
	"name_en" text NOT NULL,
	"lore_zh" text,
	"lore_en" text,
	"rarity" "rarity" DEFAULT 'common' NOT NULL,
	"drop_weight" integer DEFAULT 1 NOT NULL,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"theme_color" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"available_from" timestamp with time zone,
	"available_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_packs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "shard_balances" (
	"child_id" uuid NOT NULL,
	"pack_id" uuid NOT NULL,
	"shards" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "shard_balances_child_id_pack_id_pk" PRIMARY KEY("child_id","pack_id")
);
--> statement-breakpoint
CREATE TABLE "avatar_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot_id" text NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"unlock_via" "avatar_unlock_via" DEFAULT 'shop' NOT NULL,
	"unlock_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "avatar_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"display_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "child_avatar_equipped" (
	"child_id" uuid NOT NULL,
	"slot_id" text NOT NULL,
	"avatar_item_id" uuid,
	CONSTRAINT "child_avatar_equipped_child_id_slot_id_pk" PRIMARY KEY("child_id","slot_id")
);
--> statement-breakpoint
CREATE TABLE "child_avatar_inventory" (
	"child_id" uuid NOT NULL,
	"avatar_item_id" uuid NOT NULL,
	"obtained_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "child_avatar_inventory_child_id_avatar_item_id_pk" PRIMARY KEY("child_id","avatar_item_id")
);
--> statement-breakpoint
CREATE TABLE "powerup_inventory" (
	"child_id" uuid NOT NULL,
	"kind" "powerup_kind" NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "powerup_inventory_child_id_kind_pk" PRIMARY KEY("child_id","kind")
);
--> statement-breakpoint
CREATE TABLE "ai_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "ai_job_kind" NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"status" "ai_job_status" DEFAULT 'queued' NOT NULL,
	"model" text,
	"tokens_in" integer,
	"tokens_out" integer,
	"cost_usd" numeric(10, 4),
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_parent_user_id_users_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_current_curriculum_pack_id_curriculum_packs_id_fk" FOREIGN KEY ("current_curriculum_pack_id") REFERENCES "public"."curriculum_packs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_sentence" ADD CONSTRAINT "character_sentence_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_sentence" ADD CONSTRAINT "character_sentence_sentence_id_example_sentences_id_fk" FOREIGN KEY ("sentence_id") REFERENCES "public"."example_sentences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_word" ADD CONSTRAINT "character_word_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_word" ADD CONSTRAINT "character_word_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_packs" ADD CONSTRAINT "curriculum_packs_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_characters" ADD CONSTRAINT "week_characters_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_characters" ADD CONSTRAINT "week_characters_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weeks" ADD CONSTRAINT "weeks_parent_user_id_users_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weeks" ADD CONSTRAINT "weeks_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weeks" ADD CONSTRAINT "weeks_curriculum_pack_id_curriculum_packs_id_fk" FOREIGN KEY ("curriculum_pack_id") REFERENCES "public"."curriculum_packs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_attempts" ADD CONSTRAINT "scene_attempts_session_id_play_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."play_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_attempts" ADD CONSTRAINT "scene_attempts_week_level_id_week_levels_id_fk" FOREIGN KEY ("week_level_id") REFERENCES "public"."week_levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_levels" ADD CONSTRAINT "week_levels_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_levels" ADD CONSTRAINT "week_levels_scene_template_id_scene_templates_id_fk" FOREIGN KEY ("scene_template_id") REFERENCES "public"."scene_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_progress" ADD CONSTRAINT "week_progress_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_progress" ADD CONSTRAINT "week_progress_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_balances" ADD CONSTRAINT "coin_balances_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gacha_pulls" ADD CONSTRAINT "gacha_pulls_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_purchases" ADD CONSTRAINT "shop_purchases_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_purchases" ADD CONSTRAINT "shop_purchases_shop_item_id_shop_items_id_fk" FOREIGN KEY ("shop_item_id") REFERENCES "public"."shop_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_collections" ADD CONSTRAINT "child_collections_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_collections" ADD CONSTRAINT "child_collections_item_id_collectible_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."collectible_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collectible_items" ADD CONSTRAINT "collectible_items_pack_id_collection_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."collection_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shard_balances" ADD CONSTRAINT "shard_balances_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shard_balances" ADD CONSTRAINT "shard_balances_pack_id_collection_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."collection_packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_items" ADD CONSTRAINT "avatar_items_slot_id_avatar_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."avatar_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_avatar_equipped" ADD CONSTRAINT "child_avatar_equipped_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_avatar_equipped" ADD CONSTRAINT "child_avatar_equipped_slot_id_avatar_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."avatar_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_avatar_equipped" ADD CONSTRAINT "child_avatar_equipped_avatar_item_id_avatar_items_id_fk" FOREIGN KEY ("avatar_item_id") REFERENCES "public"."avatar_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_avatar_inventory" ADD CONSTRAINT "child_avatar_inventory_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_avatar_inventory" ADD CONSTRAINT "child_avatar_inventory_avatar_item_id_avatar_items_id_fk" FOREIGN KEY ("avatar_item_id") REFERENCES "public"."avatar_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "powerup_inventory" ADD CONSTRAINT "powerup_inventory_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "characters_hanzi_script_unique" ON "characters" USING btree ("hanzi","script");--> statement-breakpoint
CREATE UNIQUE INDEX "curriculum_packs_slug_owner_unique" ON "curriculum_packs" USING btree ("slug","owner_user_id");--> statement-breakpoint
CREATE INDEX "curriculum_packs_owner_idx" ON "curriculum_packs" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "weeks_child_idx" ON "weeks" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "weeks_status_idx" ON "weeks" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "weeks_child_week_unique" ON "weeks" USING btree ("child_id","week_number");--> statement-breakpoint
CREATE INDEX "play_sessions_child_idx" ON "play_sessions" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "scene_attempts_session_idx" ON "scene_attempts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "scene_attempts_level_idx" ON "scene_attempts" USING btree ("week_level_id");--> statement-breakpoint
CREATE INDEX "scene_templates_type_idx" ON "scene_templates" USING btree ("type");--> statement-breakpoint
CREATE INDEX "week_levels_week_idx" ON "week_levels" USING btree ("week_id");--> statement-breakpoint
CREATE INDEX "week_levels_week_position_idx" ON "week_levels" USING btree ("week_id","position");--> statement-breakpoint
CREATE INDEX "coin_txn_child_idx" ON "coin_transactions" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "coin_txn_child_created_idx" ON "coin_transactions" USING btree ("child_id","created_at");--> statement-breakpoint
CREATE INDEX "gacha_pulls_child_idx" ON "gacha_pulls" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "gacha_pulls_pack_idx" ON "gacha_pulls" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "shop_items_kind_idx" ON "shop_items" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "shop_purchases_child_idx" ON "shop_purchases" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "collectible_items_pack_idx" ON "collectible_items" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "avatar_items_slot_idx" ON "avatar_items" USING btree ("slot_id");--> statement-breakpoint
CREATE INDEX "ai_jobs_status_idx" ON "ai_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_jobs_kind_idx" ON "ai_jobs" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");