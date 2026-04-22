CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students ON DELETE CASCADE,
  event_type text NOT NULL,
  xp_delta integer NOT NULL DEFAULT 0,
  summary text NOT NULL DEFAULT '',
  source_table text,
  source_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students ON DELETE CASCADE,
  actor_name text NOT NULL DEFAULT '',
  feed_type text NOT NULL,
  title text NOT NULL,
  body text,
  xp_delta integer NOT NULL DEFAULT 0,
  source_table text,
  source_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activity_feed ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students ON DELETE CASCADE,
  reaction text NOT NULL DEFAULT 'cheer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, student_id, reaction)
);

CREATE INDEX IF NOT EXISTS xp_events_student_created_idx
  ON xp_events(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS activity_feed_created_idx
  ON activity_feed(created_at DESC);

CREATE INDEX IF NOT EXISTS activity_reactions_activity_idx
  ON activity_reactions(activity_id, created_at DESC);

ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xp_events_own_select" ON xp_events FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY "activity_feed_read_authenticated" ON activity_feed FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "activity_feed_own_insert" ON activity_feed FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY "activity_reactions_read_authenticated" ON activity_reactions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "activity_reactions_own_insert" ON activity_reactions FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
