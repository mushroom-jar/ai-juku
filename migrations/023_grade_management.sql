-- =============================================
-- 成績管理拡張
-- =============================================

-- mock_exams に試験種別カラムを追加
-- 'mock'=模試, 'periodic'=定期テスト, 'quiz'=小テスト
ALTER TABLE mock_exams ADD COLUMN IF NOT EXISTS exam_type text NOT NULL DEFAULT 'mock';

-- 課題管理テーブル
CREATE TABLE IF NOT EXISTS assignments (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id   uuid NOT NULL REFERENCES students ON DELETE CASCADE,
  title        text NOT NULL,
  subject      text,
  due_date     date,
  submitted_at timestamptz,
  status       text NOT NULL DEFAULT 'pending',
  -- 'pending'=未提出, 'submitted'=提出済み, 'late'=遅延提出, 'graded'=評価済み
  score        int,
  max_score    int,
  memo         text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignments_own" ON assignments FOR ALL
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY "teacher_sees_assignments" ON assignments FOR SELECT
  USING (student_id IN (
    SELECT id FROM students
    WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  ));
