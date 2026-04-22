-- planに'free'（未課金）を追加し、デフォルトをfreeに変更
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_plan_check;
ALTER TABLE students ADD CONSTRAINT students_plan_check CHECK (plan IN ('free', 'basic', 'premium'));
ALTER TABLE students ALTER COLUMN plan SET DEFAULT 'free';
