-- Onboarding + Plan de Ahorro (Fase 1)
-- Agrega onboarded_at a profiles y crea la tabla savings_plans.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

DO $$ BEGIN
  CREATE TYPE savings_plan_method AS ENUM (
    'percentage_income',
    'fixed_amount',
    'none',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS savings_plans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method       savings_plan_method NOT NULL,
  params       jsonb,
  active_from  date NOT NULL,
  active_to    date,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS savings_plans_user_active_from_idx
  ON savings_plans (user_id, active_from DESC);

ALTER TABLE savings_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "savings_plans_user_policy" ON savings_plans
    FOR ALL USING (
      user_id = (
        SELECT id FROM users WHERE clerk_id = (auth.jwt() ->> 'sub')
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
