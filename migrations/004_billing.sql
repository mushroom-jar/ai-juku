-- =============================================
-- Stripe課金フィールド
-- =============================================

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS stripe_customer_id      text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  text,
  ADD COLUMN IF NOT EXISTS subscription_status     text NOT NULL DEFAULT 'inactive'
    CHECK (subscription_status IN ('active', 'inactive', 'past_due', 'canceled', 'trialing'));
