-- student_routes に concurrent カラムを追加
-- concurrent = true のとき、このルートは直前のルートと同時進行する
ALTER TABLE student_routes ADD COLUMN IF NOT EXISTS concurrent boolean NOT NULL DEFAULT false;
