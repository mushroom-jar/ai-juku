-- =============================================
-- 4日2日ペース・マスター判定の実装
-- =============================================

-- daily_tasksにタスク種別を追加
ALTER TABLE daily_tasks
  ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'new'
    CHECK (task_type IN ('new', 'review', 'test'));

-- weekly_schedulesに週の範囲とリピート情報を追加
ALTER TABLE weekly_schedules
  ADD COLUMN IF NOT EXISTS range_start int,
  ADD COLUMN IF NOT EXISTS range_end   int,
  ADD COLUMN IF NOT EXISTS is_repeat   boolean NOT NULL DEFAULT false;

-- weekly_sessionsにマスター判定結果を追加
ALTER TABLE weekly_sessions
  ADD COLUMN IF NOT EXISTS mastery_rate  numeric(4,1),
  ADD COLUMN IF NOT EXISTS passed        boolean;
