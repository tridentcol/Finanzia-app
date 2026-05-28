-- Fase 4c: perfil financiero por tarjeta de crédito
CREATE TYPE IF NOT EXISTS "public"."credit_card_payment_policy" AS ENUM('total', 'minimum', 'partial');

CREATE TABLE IF NOT EXISTS "credit_card_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "allows_directed_payment" boolean DEFAULT false NOT NULL,
  "interest_rate_monthly" numeric(7, 4),
  "payment_policy" "credit_card_payment_policy" DEFAULT 'total' NOT NULL,
  "has_promotional_terms" boolean DEFAULT false NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_cc_profiles_account" ON "credit_card_profiles" ("account_id");
CREATE INDEX IF NOT EXISTS "idx_cc_profiles_user" ON "credit_card_profiles" ("user_id");

ALTER TABLE "credit_card_profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own credit card profiles"
  ON "credit_card_profiles"
  FOR ALL
  USING (user_id = (SELECT id FROM users WHERE clerk_id = auth.uid()::text))
  WITH CHECK (user_id = (SELECT id FROM users WHERE clerk_id = auth.uid()::text));
