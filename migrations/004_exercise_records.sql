CREATE TABLE exercise_records (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  date            date NOT NULL DEFAULT CURRENT_DATE,
  subject         text NOT NULL DEFAULT '',
  material        text NOT NULL DEFAULT '',
  range           text NOT NULL DEFAULT '',
  question_count  int NOT NULL DEFAULT 0,
  correct_count   int NOT NULL DEFAULT 0,
  duration        int NOT NULL DEFAULT 0,
  needs_review    boolean NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE exercise_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercise_records_own" ON exercise_records FOR ALL
  USING (user_id = auth.uid());

CREATE TABLE problem_records (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  exercise_record_id  uuid REFERENCES exercise_records ON DELETE CASCADE NOT NULL,
  problem_label       text NOT NULL DEFAULT '',
  result              text NOT NULL DEFAULT 'correct' CHECK (result IN ('correct', 'partial', 'wrong')),
  needs_review        boolean NOT NULL DEFAULT false,
  reason              text NOT NULL DEFAULT '',
  memo                text NOT NULL DEFAULT '',
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE problem_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "problem_records_own" ON problem_records FOR ALL
  USING (exercise_record_id IN (
    SELECT id FROM exercise_records WHERE user_id = auth.uid()
  ));
