CREATE TABLE "home_room_surfaces" (
	"child_id" uuid NOT NULL,
	"room" text NOT NULL,
	"wallpaper_slug" text NOT NULL,
	"floor_slug" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "home_room_surfaces_child_id_room_pk" PRIMARY KEY("child_id","room")
);
--> statement-breakpoint
ALTER TABLE "home_room_surfaces" ADD CONSTRAINT "home_room_surfaces_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;