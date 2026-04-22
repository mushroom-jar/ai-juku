-- student_routes に source カラムを追加（'ai' | 'custom'）
ALTER TABLE student_routes ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'ai';
