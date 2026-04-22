import type { SupabaseClient } from "@supabase/supabase-js";

export const XP_RULES = {
  task_complete: 10,
  task_undo: -10,
  problem_record_any: 1,
  problem_record_perfect: 3,
  mock_exam_logged: 15,
} as const;

type AwardXpParams = {
  supabase: SupabaseClient;
  studentId: string;
  actorName: string;
  eventType: keyof typeof XP_RULES | string;
  xpDelta: number;
  summary: string;
  feedType: string;
  title: string;
  body?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function awardXpAndCreateFeed({
  supabase,
  studentId,
  actorName,
  eventType,
  xpDelta,
  summary,
  feedType,
  title,
  body = null,
  sourceTable = null,
  sourceId = null,
  metadata = {},
}: AwardXpParams) {
  const { data: student } = await supabase
    .from("students")
    .select("xp")
    .eq("id", studentId)
    .single();

  const currentXp = student?.xp ?? 0;
  const newXp = Math.max(0, currentXp + xpDelta);

  await supabase
    .from("students")
    .update({ xp: newXp })
    .eq("id", studentId);

  await supabase
    .from("xp_events")
    .insert({
      student_id: studentId,
      event_type: eventType,
      xp_delta: xpDelta,
      summary,
      source_table: sourceTable,
      source_id: sourceId,
      metadata,
    });

  await supabase
    .from("activity_feed")
    .insert({
      student_id: studentId,
      actor_name: actorName,
      feed_type: feedType,
      title,
      body,
      xp_delta: xpDelta,
      source_table: sourceTable,
      source_id: sourceId,
      metadata,
    });

  return { previousXp: currentXp, xp: newXp, delta: xpDelta };
}
