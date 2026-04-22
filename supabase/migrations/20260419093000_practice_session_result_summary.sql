alter table practice_sessions
add column if not exists result_summary jsonb;
