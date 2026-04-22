-- 016: practice sessions for study-time leaderboard
CREATE TABLE IF NOT EXISTS practice_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL REFERENCES students ON DELETE CASCADE,
  book_id uuid REFERENCES books ON DELETE SET NULL,
  study_minutes integer NOT NULL CHECK (study_minutes > 0),
  source text NOT NULL DEFAULT 'practice' CHECK (source IN ('practice')),
  started_at timestamptz,
  ended_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
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
