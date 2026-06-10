CREATE TABLE "festival_challenge_claims" (
	"child_id" uuid NOT NULL,
	"month_key" text NOT NULL,
	"card_slug" text NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "festival_challenge_claims_child_id_month_key_pk" PRIMARY KEY("child_id","month_key")
);
--> statement-breakpoint
ALTER TABLE "collection_packs" ADD COLUMN "gacha_eligible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "festival_challenge_claims" ADD CONSTRAINT "festival_challenge_claims_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;