-- Expand subject CHECK constraints to support all 12 subjects

-- books table
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_subject_check;
ALTER TABLE books ADD CONSTRAINT books_subject_check
  CHECK (subject IN ('math','physics','chemistry','biology','english','japanese','world_history','japanese_history','geography','civics','information','other'));

-- question_logs table
ALTER TABLE question_logs DROP CONSTRAINT IF EXISTS question_logs_subject_check;
ALTER TABLE question_logs ADD CONSTRAINT question_logs_subject_check
  CHECK (subject IS NULL OR subject IN ('math','physics','chemistry','biology','english','japanese','world_history','japanese_history','geography','civics','information','other'));
