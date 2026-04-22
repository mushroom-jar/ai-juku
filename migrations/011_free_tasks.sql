-- =============================================
-- 自由タスク（ユーザー or AI が追加するメモ的タスク）
-- =============================================

CREATE TABLE free_tasks (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  uuid REFERENCES students ON DELETE CASCADE,
  date        date NOT NULL,
  title       text NOT NULL,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'done', 'skipped')),
  source      text NOT NULL DEFAULT 'user'
              CHECK (source IN ('user', 'ai')),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE free_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "free_tasks_own" ON free_tasks FOR ALL
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
