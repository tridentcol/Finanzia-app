CREATE TABLE "net_worth_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"net" numeric(15, 2) NOT NULL,
	"assets" numeric(15, 2),
	"debts" numeric(15, 2),
	"currency" text NOT NULL,
	"source" text DEFAULT 'cron' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "net_worth_snapshots" ADD CONSTRAINT "net_worth_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_net_worth_snapshots_user_date" ON "net_worth_snapshots" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_net_worth_snapshots_user" ON "net_worth_snapshots" USING btree ("user_id","date");