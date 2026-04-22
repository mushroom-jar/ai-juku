-- =============================================
-- 書籍表紙画像対応
-- =============================================

-- books テーブルに表紙画像URLカラムを追加
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_url text;

-- Storage バケット作成（書籍表紙・パブリック読み取り）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'book-covers',
  'book-covers',
  true,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage ポリシー
CREATE POLICY "book_covers_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'book-covers');

CREATE POLICY "book_covers_auth_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'book-covers' AND auth.role() = 'authenticated');

CREATE POLICY "book_covers_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'book-covers' AND auth.role() = 'authenticated');
