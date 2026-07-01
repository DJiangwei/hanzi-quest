CREATE TABLE "final_boss_clears" (
	"child_id" uuid NOT NULL,
	"pack_id" uuid NOT NULL,
	"cleared_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "final_boss_clears_child_id_pack_id_pk" PRIMARY KEY("child_id","pack_id")
);
--> statement-breakpoint
ALTER TABLE "final_boss_clears" ADD CONSTRAINT "final_boss_clears_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_boss_clears" ADD CONSTRAINT "final_boss_clears_pack_id_curriculum_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."curriculum_packs"("id") ON DELETE cascade ON UPDATE no action;