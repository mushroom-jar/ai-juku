ALTER TABLE students
  ADD COLUMN IF NOT EXISTS starter_grade_label        text,
  ADD COLUMN IF NOT EXISTS starter_goal_status        text,
  ADD COLUMN IF NOT EXISTS starter_target_name        text,
  ADD COLUMN IF NOT EXISTS starter_worry_subject      text,
  ADD COLUMN IF NOT EXISTS starter_questions_completed_at timestamptz;
