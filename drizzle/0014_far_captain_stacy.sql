CREATE TABLE "parent_settings" (
	"clerk_user_id" text PRIMARY KEY NOT NULL,
	"parent_pin_hash" text NOT NULL,
	"pin_set_at" timestamp with time zone DEFAULT now() NOT NULL,
	"failed_attempts" smallint DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone
);
