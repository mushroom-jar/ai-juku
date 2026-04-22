ALTER TABLE students
  ADD COLUMN IF NOT EXISTS billing_interval text NOT NULL DEFAULT 'monthly'
    CHECK (billing_interval IN ('monthly', 'yearly'));

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS ai_support_trial_used boolean NOT NULL DEFAULT false;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS ai_juku_trial_used boolean NOT NULL DEFAULT false;
