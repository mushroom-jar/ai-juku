-- AI先生が編集できるホーム画面の一言メッセージ
ALTER TABLE students ADD COLUMN IF NOT EXISTS home_message text;
