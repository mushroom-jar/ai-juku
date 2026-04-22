-- =============================================
-- 024: 教材（仮想の本）システム拡張
-- =============================================

-- books に課題プリント用フィールドを追加
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS due_date       date,
  ADD COLUMN IF NOT EXISTS problem_labels jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS description    text;

-- assignments に book_id を追加（仮想の本と紐付け）
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS book_id uuid REFERENCES books ON DELETE SET NULL;

-- exercise_records に公開フラグと book_id を追加
ALTER TABLE exercise_records
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS book_id uuid REFERENCES books ON DELETE SET NULL;

-- problem_results に公開フラグを追加
ALTER TABLE problem_results
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- problem_results の RLS を更新（同校の公開記録を閲覧可）
DROP POLICY IF EXISTS "problem_results_school_read" ON problem_results;
CREATE POLICY "problem_results_school_read" ON problem_results FOR SELECT
  USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
    OR (
      is_public = true AND
      book_id IN (
        SELECT id FROM books WHERE
          source IN ('official', 'community')
          OR registered_by IN (SELECT id FROM students WHERE user_id = auth.uid())
          OR (
            source = 'school' AND school_name IN (
              SELECT school_name FROM students
              WHERE user_id = auth.uid() AND school_name IS NOT NULL
            )
          )
      )
    )
  );

-- 教材レビューテーブル
CREATE TABLE IF NOT EXISTS material_reviews (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id    uuid NOT NULL REFERENCES books ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students ON DELETE CASCADE,
  rating     int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  difficulty int CHECK (difficulty BETWEEN 1 AND 5),
  comment    text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (book_id, student_id)
);

ALTER TABLE material_reviews ENABLE ROW LEVEL SECURITY;

-- レビューは同校・コミュニティ教材なら全員閲覧可
CREATE POLICY "material_reviews_read" ON material_reviews FOR SELECT USING (true);
CREATE POLICY "material_reviews_write" ON material_reviews FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "material_reviews_own_update" ON material_reviews FOR UPDATE
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "material_reviews_own_delete" ON material_reviews FOR DELETE
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
