-- =============================================
-- 006: 教材コミュニティ共有 + 問題記録4段階
-- =============================================

-- booksテーブルに source と登録者を追加
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS source        text NOT NULL DEFAULT 'official'
    CHECK (source IN ('official', 'community', 'private')),
  ADD COLUMN IF NOT EXISTS registered_by uuid REFERENCES students ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS use_count     int NOT NULL DEFAULT 0;

-- 既存データはすべてofficial
UPDATE books SET source = 'official';

-- subjectにenglishを追加（CHECK制約を更新）
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_subject_check;
ALTER TABLE books ADD CONSTRAINT books_subject_check
  CHECK (subject IN ('math', 'physics', 'chemistry', 'english'));

-- コミュニティ教材の挿入・更新ポリシー
DROP POLICY IF EXISTS "books_community_insert" ON books;
CREATE POLICY "books_community_insert" ON books FOR INSERT
  WITH CHECK (
    source IN ('community', 'private') AND
    registered_by IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "books_community_update" ON books;
CREATE POLICY "books_community_update" ON books FOR UPDATE
  USING (
    registered_by IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- =============================================
-- 問題ごとの4段階記録テーブル
-- =============================================
CREATE TABLE IF NOT EXISTS problem_results (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  uuid REFERENCES students ON DELETE CASCADE NOT NULL,
  book_id     uuid REFERENCES books ON DELETE CASCADE NOT NULL,
  problem_no  int NOT NULL,
  result      text NOT NULL CHECK (result IN ('perfect', 'unsure', 'checked', 'wrong')),
  task_id     uuid REFERENCES daily_tasks ON DELETE SET NULL,
  recorded_at timestamptz DEFAULT now(),
  UNIQUE (student_id, book_id, problem_no)
);

ALTER TABLE problem_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "problem_results_own" ON problem_results;
CREATE POLICY "problem_results_own" ON problem_results FOR ALL
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- =============================================
-- use_countを自動更新するトリガー
-- =============================================
CREATE OR REPLACE FUNCTION increment_book_use_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE books SET use_count = use_count + 1 WHERE id = NEW.book_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_route_added ON student_routes;
CREATE TRIGGER on_route_added
  AFTER INSERT ON student_routes
  FOR EACH ROW EXECUTE FUNCTION increment_book_use_count();
