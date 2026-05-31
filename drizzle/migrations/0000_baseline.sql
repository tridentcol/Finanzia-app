CREATE TYPE "public"."account_type" AS ENUM('checking', 'savings', 'credit_card', 'cash', 'investment', 'crypto', 'other');--> statement-breakpoint
CREATE TYPE "public"."alert_kind" AS ENUM('unusual_spend', 'budget_exceeded', 'recurring_due', 'low_balance', 'goal_at_risk');--> statement-breakpoint
CREATE TYPE "public"."budget_period" AS ENUM('monthly', 'weekly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."category_kind" AS ENUM('income', 'expense', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."credit_card_payment_policy" AS ENUM('total', 'minimum', 'partial');--> statement-breakpoint
CREATE TYPE "public"."debt_status" AS ENUM('active', 'paid', 'defaulted');--> statement-breakpoint
CREATE TYPE "public"."debt_type" AS ENUM('loan_personal', 'mortgage', 'auto_loan', 'student_loan', 'family_loan', 'other');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'paused', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."insight_kind" AS ENUM('anomaly', 'trend', 'forecast', 'recommendation', 'achievement');--> statement-breakpoint
CREATE TYPE "public"."insight_severity" AS ENUM('info', 'notice', 'warning');--> statement-breakpoint
CREATE TYPE "public"."insight_status" AS ENUM('unread', 'read', 'dismissed', 'acted');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('anthropic', 'openai');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('active', 'invalid', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'tool');--> statement-breakpoint
CREATE TYPE "public"."recurring_frequency" AS ENUM('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."savings_plan_method" AS ENUM('percentage_income', 'fixed_amount', 'none', 'other');--> statement-breakpoint
CREATE TYPE "public"."transaction_kind" AS ENUM('income', 'expense', 'transfer');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "account_type" NOT NULL,
	"currency" text NOT NULL,
	"initial_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"credit_limit" numeric(15, 2),
	"statement_day" smallint,
	"payment_day" smallint,
	"bank_slug" text,
	"card_product_slug" text,
	"card_brand" text,
	"card_last_four" text,
	"card_holder_name" text,
	"color" text,
	"icon" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "alert_kind" NOT NULL,
	"ref_id" uuid,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"period" "budget_period" DEFAULT 'monthly' NOT NULL,
	"start_date" date NOT NULL,
	"rollover" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"parent_id" uuid,
	"name" text NOT NULL,
	"kind" "category_kind" NOT NULL,
	"icon" text,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"lender" text,
	"type" "debt_type" NOT NULL,
	"principal" numeric(15, 2) NOT NULL,
	"current_balance" numeric(15, 2) NOT NULL,
	"currency" text NOT NULL,
	"interest_rate" numeric(7, 4),
	"installment_amount" numeric(15, 2),
	"term_months" integer,
	"origin_date" date,
	"next_payment_date" date,
	"payment_day" smallint,
	"linked_account_id" uuid,
	"status" "debt_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_inbox_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"alias_slug" text NOT NULL,
	"bank" text NOT NULL,
	"account_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"date" date NOT NULL,
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"rate" numeric(15, 6) NOT NULL,
	"source" text DEFAULT 'exchangerate.host' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_rates_date_from_currency_to_currency_pk" PRIMARY KEY("date","from_currency","to_currency")
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_amount" numeric(15, 2) NOT NULL,
	"currency" text NOT NULL,
	"target_date" date,
	"linked_account_id" uuid,
	"current_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"imported_rows" integer DEFAULT 0 NOT NULL,
	"status" "import_status" DEFAULT 'pending' NOT NULL,
	"mapping" jsonb,
	"errors" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "insight_kind" NOT NULL,
	"severity" "insight_severity" DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"action" jsonb,
	"status" "insight_status" DEFAULT 'unread' NOT NULL,
	"period_start" date,
	"period_end" date,
	"generated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "intent_examples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intent" text NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period" text NOT NULL,
	"total_income" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_expense" numeric(15, 2) DEFAULT '0' NOT NULL,
	"net_savings" numeric(15, 2) DEFAULT '0' NOT NULL,
	"top_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"top_merchants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_summary" text,
	"ai_habits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"base_currency" text DEFAULT 'COP' NOT NULL,
	"secondary_currencies" text[] DEFAULT ARRAY['USD']::text[] NOT NULL,
	"locale" text DEFAULT 'es-CO' NOT NULL,
	"timezone" text DEFAULT 'America/Bogota' NOT NULL,
	"ai_profile" jsonb,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"description" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" text NOT NULL,
	"kind" "transaction_kind" NOT NULL,
	"frequency" "recurring_frequency" NOT NULL,
	"day_of_month" smallint,
	"day_of_week" smallint,
	"next_run" date,
	"last_run" date,
	"active" boolean DEFAULT true NOT NULL,
	"auto_create" boolean DEFAULT true NOT NULL,
	"tolerance_days" smallint DEFAULT 2 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"date" date NOT NULL,
	"amount_original" numeric(15, 2) NOT NULL,
	"currency" text NOT NULL,
	"amount_base" numeric(15, 2) NOT NULL,
	"exchange_rate" numeric(15, 6),
	"description" text NOT NULL,
	"merchant" text,
	"kind" "transaction_kind" NOT NULL,
	"transfer_account_id" uuid,
	"transfer_group_id" uuid,
	"notes" text,
	"tags" text[],
	"recurring_rule_id" uuid,
	"import_batch_id" uuid,
	"ai_categorized" boolean DEFAULT false NOT NULL,
	"ai_confidence" numeric(3, 2),
	"user_corrected" boolean DEFAULT false NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_integrations" (
	"user_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"secret_id" uuid NOT NULL,
	"scopes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"status" "integration_status" DEFAULT 'active' NOT NULL,
	"last_validated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_integrations_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_profiles" ADD CONSTRAINT "credit_card_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_profiles" ADD CONSTRAINT "credit_card_profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_linked_account_id_accounts_id_fk" FOREIGN KEY ("linked_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_inbox_aliases" ADD CONSTRAINT "email_inbox_aliases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_inbox_aliases" ADD CONSTRAINT "email_inbox_aliases_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_linked_account_id_accounts_id_fk" FOREIGN KEY ("linked_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_reports" ADD CONSTRAINT "monthly_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_periods" ADD CONSTRAINT "savings_periods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_periods" ADD CONSTRAINT "savings_periods_plan_id_savings_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."savings_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_plans" ADD CONSTRAINT "savings_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transfer_account_id_accounts_id_fk" FOREIGN KEY ("transfer_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurring_rule_id_recurring_rules_id_fk" FOREIGN KEY ("recurring_rule_id") REFERENCES "public"."recurring_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_integrations" ADD CONSTRAINT "user_integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accounts_user" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_alerts_user_read" ON "alerts" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "idx_budgets_user_category" ON "budgets" USING btree ("user_id","category_id");--> statement-breakpoint
CREATE INDEX "idx_categories_user" ON "categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_user" ON "conversations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cc_profiles_account" ON "credit_card_profiles" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_cc_profiles_user" ON "credit_card_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_debts_user" ON "debts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_debts_user_status" ON "debts" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_email_aliases_slug" ON "email_inbox_aliases" USING btree ("alias_slug");--> statement-breakpoint
CREATE INDEX "idx_email_aliases_user" ON "email_inbox_aliases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_goals_user" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_insights_user_status" ON "insights" USING btree ("user_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_intent_examples_text" ON "intent_examples" USING btree ("text");--> statement-breakpoint
CREATE INDEX "idx_intent_examples_embedding" ON "intent_examples" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_messages_conversation" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_monthly_reports_user_period" ON "monthly_reports" USING btree ("user_id","period");--> statement-breakpoint
CREATE INDEX "idx_monthly_reports_user" ON "monthly_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "savings_periods_user_period_end_idx" ON "savings_periods" USING btree ("user_id","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "savings_periods_user_period_end_unique" ON "savings_periods" USING btree ("user_id","period_end");--> statement-breakpoint
CREATE INDEX "savings_plans_user_active_from_idx" ON "savings_plans" USING btree ("user_id","active_from");--> statement-breakpoint
CREATE INDEX "idx_transactions_user_date" ON "transactions" USING btree ("user_id","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_transactions_user_category" ON "transactions" USING btree ("user_id","category_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_account" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_transfer_group" ON "transactions" USING btree ("transfer_group_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_embedding" ON "transactions" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_user_integrations_user" ON "user_integrations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_clerk_id" ON "users" USING btree ("clerk_id");