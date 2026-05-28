-- Fase 3a: tolerance_days para drift de recurrentes
ALTER TABLE recurring_rules ADD COLUMN IF NOT EXISTS tolerance_days smallint NOT NULL DEFAULT 2;
