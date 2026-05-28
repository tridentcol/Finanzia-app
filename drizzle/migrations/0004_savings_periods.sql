-- Savings periods — historial mensual de ahorro (Fase 2)

CREATE TABLE IF NOT EXISTS savings_periods (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id         uuid NOT NULL REFERENCES savings_plans(id) ON DELETE RESTRICT,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  target_amount   numeric(15,2) NOT NULL,
  achieved_amount numeric(15,2) NOT NULL DEFAULT 0,
  computed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS savings_periods_user_period_end_idx
  ON savings_periods (user_id, period_end DESC);

CREATE UNIQUE INDEX IF NOT EXISTS savings_periods_user_period_end_unique
  ON savings_periods (user_id, period_end);

ALTER TABLE savings_periods ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "savings_periods_user_policy" ON savings_periods
    FOR ALL USING (
      user_id = (
        SELECT id FROM users WHERE clerk_id = (auth.jwt() ->> 'sub')
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
