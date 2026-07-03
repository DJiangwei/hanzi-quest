CREATE TABLE "answer_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"week_id" uuid,
	"source" text NOT NULL,
	"scene_type" text NOT NULL,
	"character_id" uuid,
	"word_id" uuid,
	"item_key" text,
	"correct" boolean,
	"self_rating" text,
	"picked_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "answer_events" ADD CONSTRAINT "answer_events_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_events" ADD CONSTRAINT "answer_events_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_events" ADD CONSTRAINT "answer_events_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_events" ADD CONSTRAINT "answer_events_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "answer_events_child_char_idx" ON "answer_events" USING btree ("child_id","character_id");--> statement-breakpoint
CREATE INDEX "answer_events_child_time_idx" ON "answer_events" USING btree ("child_id","created_at");