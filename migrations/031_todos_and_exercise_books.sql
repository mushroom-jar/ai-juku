-- Todos テーブル
CREATE TABLE IF NOT EXISTS todos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title       text NOT NULL,
  category    text NOT NULL DEFAULT 'today' CHECK (category IN ('today', 'review', 'other')),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  source      text DEFAULT 'manual',  -- 'manual' | 'ai' | 'exercise'
  ref_id      uuid,                    -- 演習記録IDなどの参照
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Exercise books (教材管理)
CREATE TABLE IF NOT EXISTS exercise_books (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title        text NOT NULL,
  subject      text NOT NULL DEFAULT 'other',
  total_pages  integer,
  current_page integer NOT NULL DEFAULT 0,
  cover_color  text NOT NULL DEFAULT '#3157B7',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Exercise records (演習記録) - exercise_booksに紐づく
CREATE TABLE IF NOT EXISTS exercise_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  book_id         uuid REFERENCES exercise_books(id) ON DELETE CASCADE,
  page_start      integer,
  page_end        integer,
  correct_count   integer,
  total_count     integer,
  memo            text,
  needs_review    boolean NOT NULL DEFAULT false,
  studied_at      date NOT NULL DEFAULT CURRENT_DATE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS todos_student_idx          ON todos(student_id);
CREATE INDEX IF NOT EXISTS exercise_books_student_idx ON exercise_books(student_id);
CREATE INDEX IF NOT EXISTS exercise_records_book_idx  ON exercise_records(book_id);
CREATE INDEX IF NOT EXISTS exercise_records_student_idx ON exercise_records(student_id);

-- RLS
ALTER TABLE todos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_books   ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "todos_own"            ON todos;
DROP POLICY IF EXISTS "exercise_books_own"   ON exercise_books;
DROP POLICY IF EXISTS "exercise_records_own" ON exercise_records;

CREATE POLICY "todos_own" ON todos
  FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY "exercise_books_own" ON exercise_books
  FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY "exercise_records_own" ON exercise_records
  FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));
