CREATE TABLE "weekly_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"ai_summary" text,
	"highlights" jsonb NOT NULL,
	"status" text DEFAULT 'unread' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "weekly_checkins" ADD CONSTRAINT "weekly_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_weekly_checkins_user_week" ON "weekly_checkins" USING btree ("user_id","week_start");--> statement-breakpoint
CREATE INDEX "idx_weekly_checkins_user" ON "weekly_checkins" USING btree ("user_id","week_start");