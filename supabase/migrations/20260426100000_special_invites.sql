-- 特別招待コード
CREATE TABLE IF NOT EXISTS special_invites (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text UNIQUE NOT NULL,
  plan               text NOT NULL CHECK (plan IN ('basic', 'premium')),
  free_months        integer NOT NULL DEFAULT 1 CHECK (free_months > 0),
  max_uses           integer NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  used_count         integer NOT NULL DEFAULT 0,
  expires_at         timestamptz,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type        text NOT NULL DEFAULT 'student' CHECK (target_type IN ('student', 'parent', 'org')),
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  note               text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- 特別招待使用履歴
CREATE TABLE IF NOT EXISTS special_invite_uses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  special_invite_id uuid NOT NULL REFERENCES special_invites(id) ON DELETE CASCADE,
  student_id        uuid REFERENCES students(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at           timestamptz NOT NULL DEFAULT now(),
  granted_plan      text NOT NULL,
  granted_until     timestamptz NOT NULL
);

-- 個別無料付与履歴
CREATE TABLE IF NOT EXISTS manual_plan_grants (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  granted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  plan               text NOT NULL CHECK (plan IN ('basic', 'premium')),
  granted_until      timestamptz NOT NULL,
  note               text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- students に plan_source を追加
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS plan_source text
    CHECK (plan_source IN ('paid', 'special_invite', 'manual_grant', 'trial'));

-- インデックス
CREATE INDEX IF NOT EXISTS special_invites_code_idx       ON special_invites(code);
CREATE INDEX IF NOT EXISTS special_invite_uses_invite_idx ON special_invite_uses(special_invite_id);
CREATE INDEX IF NOT EXISTS special_invite_uses_student_idx ON special_invite_uses(student_id);
CREATE INDEX IF NOT EXISTS manual_plan_grants_student_idx  ON manual_plan_grants(student_id);

-- RLS
ALTER TABLE special_invites       ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_invite_uses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_plan_grants    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "special_invites_creator" ON special_invites;
CREATE POLICY "special_invites_creator" ON special_invites
  FOR ALL USING (created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "special_invite_uses_own" ON special_invite_uses;
CREATE POLICY "special_invite_uses_own" ON special_invite_uses
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "manual_plan_grants_grantor" ON manual_plan_grants;
CREATE POLICY "manual_plan_grants_grantor" ON manual_plan_grants
  FOR SELECT USING (
    granted_by_user_id = auth.uid()
    OR student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );
