CREATE TABLE "child_shards" (
	"child_id" uuid PRIMARY KEY NOT NULL,
	"shards" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "child_shards" ADD CONSTRAINT "child_shards_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;