CREATE TYPE "public"."credit_card_payment_policy" AS ENUM('total', 'minimum', 'partial');--> statement-breakpoint
CREATE TYPE "public"."savings_plan_method" AS ENUM('percentage_income', 'fixed_amount', 'none', 'other');--> statement-breakpoint
CREATE TABLE "credit_card_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"allows_directed_payment" boolean DEFAULT false NOT NULL,
	"interest_rate_monthly" numeric(7, 4),
	"payment_policy" "credit_card_payment_policy" DEFAULT 'total' NOT NULL,
	"has_promotional_terms" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"target_amount" numeric(15, 2) NOT NULL,
	"achieved_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"method" "savings_plan_method" NOT NULL,
	"params" jsonb,
	"active_from" date NOT NULL,
	"active_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "bank_slug" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "card_product_slug" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "card_brand" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "card_last_four" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "card_holder_name" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD COLUMN "tolerance_days" smallint DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_card_profiles" ADD CONSTRAINT "credit_card_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_profiles" ADD CONSTRAINT "credit_card_profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_periods" ADD CONSTRAINT "savings_periods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_periods" ADD CONSTRAINT "savings_periods_plan_id_savings_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."savings_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_plans" ADD CONSTRAINT "savings_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cc_profiles_account" ON "credit_card_profiles" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_cc_profiles_user" ON "credit_card_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "savings_periods_user_period_end_idx" ON "savings_periods" USING btree ("user_id","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "savings_periods_user_period_end_unique" ON "savings_periods" USING btree ("user_id","period_end");--> statement-breakpoint
CREATE INDEX "savings_plans_user_active_from_idx" ON "savings_plans" USING btree ("user_id","active_from");