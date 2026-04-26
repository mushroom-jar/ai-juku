ALTER TABLE students
  ADD COLUMN IF NOT EXISTS target_faculty text,
  ADD COLUMN IF NOT EXISTS target_department text,
  ADD COLUMN IF NOT EXISTS target_univ_image text,
  ADD COLUMN IF NOT EXISTS exam_type text,
  ADD COLUMN IF NOT EXISTS subject_levels jsonb,
  ADD COLUMN IF NOT EXISTS last_mock_level integer,
  ADD COLUMN IF NOT EXISTS route_strategy jsonb;
