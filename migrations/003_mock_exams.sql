-- =============================================
-- 模試記録テーブル
-- =============================================

CREATE TABLE mock_exams (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      uuid REFERENCES students ON DELETE CASCADE,
  exam_name       text NOT NULL,
  exam_date       date NOT NULL,
  scores          jsonb NOT NULL DEFAULT '{}',
  -- 構造例: { "math": { "score": 170, "max": 200, "deviation": 62.5 }, ... }
  total_score     int,
  total_max       int,
  total_deviation numeric(4,1),
  memo            text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE mock_exams ENABLE ROW LEVEL SECURITY;

-- 生徒は自分の記録のみ
CREATE POLICY "mock_exams_own" ON mock_exams FOR ALL
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- 講師は担当生徒の記録を閲覧可
CREATE POLICY "teacher_sees_mock_exams" ON mock_exams FOR SELECT
  USING (student_id IN (
    SELECT id FROM students
    WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  ));

-- 親はPremium生徒の記録を閲覧可
CREATE POLICY "parent_sees_mock_exams" ON mock_exams FOR SELECT
  USING (student_id IN (
    SELECT student_id FROM parents WHERE user_id = auth.uid()
  ));
