ALTER TABLE free_tasks
  ALTER COLUMN date DROP NOT NULL;

ALTER TABLE free_tasks
  ADD COLUMN task_mode text NOT NULL DEFAULT 'later'
    CHECK (task_mode IN ('later', 'scheduled')),
  ADD COLUMN category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('club', 'test', 'lesson', 'free', 'other')),
  ADD COLUMN start_time time,
  ADD COLUMN end_time time,
  ADD COLUMN event_id uuid;

CREATE INDEX free_tasks_student_mode_idx
  ON free_tasks(student_id, task_mode, date);
