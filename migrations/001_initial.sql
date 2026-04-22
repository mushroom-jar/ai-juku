-- =============================================
-- AI塾 初期スキーマ
-- =============================================

-- 拡張機能
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ユーザー系
-- =============================================

CREATE TABLE teachers (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid REFERENCES auth.users ON DELETE CASCADE,
  name        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE students (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          uuid REFERENCES auth.users ON DELETE CASCADE,
  teacher_id       uuid REFERENCES teachers,
  name             text NOT NULL,
  grade            int NOT NULL CHECK (grade BETWEEN 1 AND 3),
  target_univ      text NOT NULL DEFAULT '',
  target_level     int NOT NULL DEFAULT 3 CHECK (target_level BETWEEN 1 AND 5),
  exam_date        date,
  current_level    int NOT NULL DEFAULT 2 CHECK (current_level BETWEEN 1 AND 5),
  subjects         text[] NOT NULL DEFAULT '{"math"}',
  plan             text NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic', 'premium')),
  line_user_id     text,
  onboarding_done  boolean NOT NULL DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE parents (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id   uuid REFERENCES students ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users ON DELETE CASCADE,
  line_user_id text,
  email        text,
  created_at   timestamptz DEFAULT now()
);

-- =============================================
-- マスターデータ系
-- =============================================

CREATE TABLE books (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           text NOT NULL,
  subject         text NOT NULL CHECK (subject IN ('math', 'physics', 'chemistry')),
  category        text NOT NULL DEFAULT '問題集',
  level           int NOT NULL CHECK (level BETWEEN 1 AND 5),
  level_label     text NOT NULL,
  publisher       text NOT NULL DEFAULT '',
  total_problems  int NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE problems (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id       uuid REFERENCES books ON DELETE CASCADE,
  problem_no    int NOT NULL,
  unit          text NOT NULL DEFAULT '',
  difficulty    int NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 3),
  estimated_min int NOT NULL DEFAULT 15,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (book_id, problem_no)
);

-- =============================================
-- ルート・スケジュール系
-- =============================================

CREATE TABLE student_routes (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id   uuid REFERENCES students ON DELETE CASCADE,
  book_id      uuid REFERENCES books,
  step_order   int NOT NULL,
  status       text NOT NULL DEFAULT 'not_started'
               CHECK (status IN ('not_started', 'in_progress', 'done')),
  started_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE weekly_schedules (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id   uuid REFERENCES students ON DELETE CASCADE,
  week_start   date NOT NULL,
  is_exam_week boolean NOT NULL DEFAULT false,
  approved_at  timestamptz,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (student_id, week_start)
);

CREATE TABLE daily_tasks (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id      uuid REFERENCES weekly_schedules ON DELETE CASCADE,
  date             date NOT NULL,
  book_id          uuid REFERENCES books,
  problem_no_start int NOT NULL,
  problem_no_end   int NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'done', 'skipped')),
  completed_at     timestamptz,
  created_at       timestamptz DEFAULT now()
);

-- =============================================
-- 記録系
-- =============================================

CREATE TABLE problem_records (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id     uuid REFERENCES students ON DELETE CASCADE,
  problem_id     uuid REFERENCES problems ON DELETE CASCADE,
  status         text NOT NULL CHECK (status IN ('solved', 'unsolved')),
  attempt_count  int NOT NULL DEFAULT 1,
  last_attempted date NOT NULL,
  mastered_at    timestamptz,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (student_id, problem_id)
);

CREATE TABLE weekly_sessions (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id           uuid REFERENCES students ON DELETE CASCADE,
  session_date         date NOT NULL,
  review_problem_ids   uuid[] NOT NULL DEFAULT '{}',
  review_results       jsonb NOT NULL DEFAULT '{}',
  checkin_comment      text,
  ai_feedback          text,
  next_schedule_id     uuid REFERENCES weekly_schedules,
  completed_at         timestamptz,
  created_at           timestamptz DEFAULT now()
);

CREATE TABLE question_logs (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    uuid REFERENCES students ON DELETE CASCADE,
  asked_at      timestamptz DEFAULT now(),
  image_url     text,
  question_text text NOT NULL DEFAULT '',
  ai_response   text NOT NULL DEFAULT '',
  subject       text CHECK (subject IN ('math', 'physics', 'chemistry')),
  via           text NOT NULL DEFAULT 'app' CHECK (via IN ('app', 'line'))
);

CREATE TABLE alerts (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id        uuid REFERENCES students ON DELETE CASCADE,
  type              text NOT NULL CHECK (type IN ('absent', 'behind_schedule')),
  consecutive_days  int NOT NULL DEFAULT 0,
  notified_teacher  boolean NOT NULL DEFAULT false,
  notified_parent   boolean NOT NULL DEFAULT false,
  created_at        timestamptz DEFAULT now()
);

-- =============================================
-- Row Level Security
-- =============================================

ALTER TABLE students        ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_routes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_tasks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE books           ENABLE ROW LEVEL SECURITY;
ALTER TABLE problems        ENABLE ROW LEVEL SECURITY;

-- books / problems は全員読み取り可
CREATE POLICY "books_read_all"    ON books    FOR SELECT USING (true);
CREATE POLICY "problems_read_all" ON problems FOR SELECT USING (true);

-- 生徒は自分のデータのみ
CREATE POLICY "student_own" ON students FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "student_routes_own" ON student_routes FOR ALL
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY "weekly_schedules_own" ON weekly_schedules FOR ALL
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY "daily_tasks_own" ON daily_tasks FOR ALL
  USING (schedule_id IN (
    SELECT id FROM weekly_schedules
    WHERE student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  ));

CREATE POLICY "problem_records_own" ON problem_records FOR ALL
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY "weekly_sessions_own" ON weekly_sessions FOR ALL
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY "question_logs_own" ON question_logs FOR ALL
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- 講師は担当生徒のデータを閲覧可
CREATE POLICY "teacher_own" ON teachers FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "teacher_sees_students" ON students FOR SELECT
  USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

CREATE POLICY "teacher_sees_records" ON problem_records FOR SELECT
  USING (student_id IN (
    SELECT id FROM students
    WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  ));

CREATE POLICY "teacher_sees_daily_tasks" ON daily_tasks FOR SELECT
  USING (schedule_id IN (
    SELECT id FROM weekly_schedules WHERE student_id IN (
      SELECT id FROM students
      WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  ));

CREATE POLICY "teacher_sees_alerts" ON alerts FOR SELECT
  USING (student_id IN (
    SELECT id FROM students
    WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  ));

-- 親はPremium生徒のデータを閲覧可
CREATE POLICY "parent_own" ON parents FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "parent_sees_child_records" ON problem_records FOR SELECT
  USING (student_id IN (
    SELECT student_id FROM parents WHERE user_id = auth.uid()
  ));
