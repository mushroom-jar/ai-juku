ALTER TABLE students
ADD COLUMN IF NOT EXISTS study_style text,
ADD COLUMN IF NOT EXISTS available_study_time jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS biggest_blocker text,
ADD COLUMN IF NOT EXISTS strength_subjects text[] NOT NULL DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS weakness_subjects text[] NOT NULL DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS onboarding_summary text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS onboarding_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS ai_interview_completed_at timestamptz,
ADD COLUMN IF NOT EXISTS interview_transcript text NOT NULL DEFAULT '';
