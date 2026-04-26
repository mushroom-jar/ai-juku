-- 支払いトークン・まとめ払い有効期限
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS payment_token text UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  ADD COLUMN IF NOT EXISTS premium_until timestamptz;

-- 既存レコードにトークンを付与
UPDATE students SET payment_token = encode(gen_random_bytes(12), 'hex') WHERE payment_token IS NULL;

-- 招待コード（生徒が持つ）
CREATE TABLE IF NOT EXISTS referral_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text UNIQUE NOT NULL,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_codes_student_id_idx ON referral_codes(student_id);

-- 招待履歴
CREATE TABLE IF NOT EXISTS referral_uses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id    uuid NOT NULL REFERENCES referral_codes(id),
  referrer_student_id uuid NOT NULL REFERENCES students(id),
  referred_user_id    uuid NOT NULL REFERENCES auth.users(id),
  converted_at        timestamptz,
  reward_status       text NOT NULL DEFAULT 'pending'
    CHECK (reward_status IN ('pending', 'issued', 'failed')),
  reward_issued_at    timestamptz,
  reward_note         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_user_id)
);

CREATE INDEX IF NOT EXISTS referral_uses_referrer_idx ON referral_uses(referrer_student_id);

-- RLS
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_uses  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referral_codes_owner" ON referral_codes;
CREATE POLICY "referral_codes_owner" ON referral_codes
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "referral_uses_referrer" ON referral_uses;
CREATE POLICY "referral_uses_referrer" ON referral_uses
  FOR SELECT USING (
    referrer_student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );
