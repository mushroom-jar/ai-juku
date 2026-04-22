-- 021: 未適用テーブルの作成 + 廃止テーブルの削除

-- ─────────────────────────────────────────
-- 1. 不足していたテーブルを作成
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS practice_sessions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    uuid NOT NULL REFERENCES students ON DELETE CASCADE,
  book_id       uuid REFERENCES books ON DELETE SET NULL,
  study_minutes integer NOT NULL CHECK (study_minutes > 0),
  source        text NOT NULL DEFAULT 'practice' CHECK (source IN ('practice')),
  started_at    timestamptz,
  ended_at      timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS practice_sessions_student_ended_idx
  ON practice_sessions(student_id, ended_at DESC);

ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "practice_sessions_own_all" ON practice_sessions;
CREATE POLICY "practice_sessions_own_all" ON practice_sessions FOR ALL
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()))
  WITH CHECK (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "practice_sessions_read_authenticated" ON practice_sessions;
CREATE POLICY "practice_sessions_read_authenticated" ON practice_sessions FOR SELECT
  USING (auth.role() = 'authenticated');

-- friendships

CREATE TABLE IF NOT EXISTS friendships (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id uuid NOT NULL REFERENCES students ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES students ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

CREATE INDEX IF NOT EXISTS friendships_requester_idx ON friendships(requester_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON friendships(addressee_id, status, created_at DESC);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friendships_involved_select" ON friendships;
CREATE POLICY "friendships_involved_select" ON friendships FOR SELECT
  USING (
    requester_id IN (SELECT id FROM students WHERE user_id = auth.uid())
    OR addressee_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "friendships_request_insert" ON friendships;
CREATE POLICY "friendships_request_insert" ON friendships FOR INSERT
  WITH CHECK (requester_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "friendships_addressee_update" ON friendships;
CREATE POLICY "friendships_addressee_update" ON friendships FOR UPDATE
  USING (addressee_id IN (SELECT id FROM students WHERE user_id = auth.uid()))
  WITH CHECK (addressee_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────
-- 2. 廃止テーブルを削除
-- ─────────────────────────────────────────

-- problem_records: problem_results に完全移行済み
DROP TABLE IF EXISTS problem_records CASCADE;

-- problem_sub_structure / problem_subsub_structure:
-- sub_no / subsub_no カラムで代替済み、不要
DROP TABLE IF EXISTS problem_sub_structure CASCADE;
DROP TABLE IF EXISTS problem_subsub_structure CASCADE;

-- problems: 個別問題マスターは未使用
DROP TABLE IF EXISTS problems CASCADE;
