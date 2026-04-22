-- =============================================
-- 020: 教材カテゴリ再編・学校内共有
-- =============================================

-- books.source に 'school' を追加
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_source_check;
ALTER TABLE books ADD CONSTRAINT books_source_check
  CHECK (source IN ('official', 'community', 'private', 'school'));

-- books に学校名カラム追加（school共有の絞り込みに使う非正規化カラム）
ALTER TABLE books ADD COLUMN IF NOT EXISTS school_name text;

-- students に学校名カラム追加
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_name text;

-- 既存カテゴリ "テスト" を "その他" に統一
UPDATE books SET category = 'その他' WHERE category = 'テスト';

-- INSERT ポリシーを school も許可するよう更新
DROP POLICY IF EXISTS "books_community_insert" ON books;
CREATE POLICY "books_community_insert" ON books FOR INSERT
  WITH CHECK (
    source IN ('community', 'private', 'school') AND
    registered_by IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- SELECT ポリシー: official/community は全員、school は同校、private は本人のみ
DROP POLICY IF EXISTS "books_read" ON books;
CREATE POLICY "books_read" ON books FOR SELECT
  USING (
    source IN ('official', 'community')
    OR registered_by IN (SELECT id FROM students WHERE user_id = auth.uid())
    OR (
      source = 'school' AND school_name IS NOT NULL AND
      school_name IN (SELECT school_name FROM students WHERE user_id = auth.uid() AND school_name IS NOT NULL)
    )
  );
